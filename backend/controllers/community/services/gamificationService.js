import { db } from "../../../config/connectDB.js";
import { redisClient } from "../../../config/redisConfig.js";
import { publishEvent } from "./eventBus.js";

// GROUP ACTIVITY POINTS LEVELS
const ACTIVITY_POINTS = {
  message: 10,
  reaction: 2,
  thread: 15,
  voiceRoom: 20,
  quoteMacro: 5
};

// LEVEL THRESHOLD
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  300,    // Level 3
  600,    // Level 4
  1000,   // Level 5
  1500,   // Level 6
  2500,   // Level 7
  4000,   // Level 8
  6000,   // Level 9
  10000   // Level 10
];

//CALCULATE LEVEL FROM XP
const calculateLevelFromXP = (xp) => {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;R
};

// INCREMENT USER ACTIVITY
export const incrementUserActivity = async (userId, chatGroupId, activityType) => {
  if (!ACTIVITY_POINTS[activityType]) {
    console.error(`Invalid activity type: ${activityType}`);
    return null;
  }
  
  const points = ACTIVITY_POINTS[activityType];
  const userStatsKey = `user:${userId}:stats:${chatGroupId}`;
  
  // GET STATS FROM CACHE OR DB
  const cachedStats = await redisClient.get(userStatsKey);
  const stats = cachedStats ? JSON.parse(cachedStats) : await getUserStats(userId, chatGroupId);
  
  const oldLevel = stats.level;
  
  // UPDATE STATS
  stats.totalPoints += points;
  stats.activityCounts[activityType] = (stats.activityCounts[activityType] || 0) + 1;
  stats.level = calculateLevelFromXP(stats.totalPoints);
  
  await Promise.all([
      redisClient.set(userStatsKey, JSON.stringify(stats), 'EX', 1800),
      updateUserStatsInDB(userId, chatGroupId, stats)
  ]);
  
  // HANDLE LEVEL UP
  if (stats.level > oldLevel) {
    await handleLevelUp(userId, chatGroupId, stats.level); 
  }
  
  return stats;
};

// GET USER STATS FROM DATABASE
export const getUserStats = async (userId, chatGroupId) => { 
  const query = `
    SELECT totalPoints, level, messageCount, reactionCount, threadCount, voiceRoomMinutes, quoteMacroCount
    FROM user_activity
    WHERE userId = ? AND chatGroupId = ?
  `;
  try {
    const [results] = await db.promise().query(query, [userId, chatGroupId]);

    // IF NO RECORD EXISTS, RETURN DEFAULT STATS
    if (results.length === 0) {
      return {
        totalPoints: 0,
        level: 1,
        activityCounts: { message: 0, reaction: 0, thread: 0, voiceRoom: 0, quoteMacro: 0 }
      };
    }
    
    // If a record exists, return its data.
    const row = results[0];
    return {
      totalPoints: row.totalPoints || 0,
      level: row.level || 1,
      activityCounts: {
        message: row.messageCount || 0,
        reaction: row.reactionCount || 0,
        thread: row.threadCount || 0,
        voiceRoom: row.voiceRoomMinutes || 0,
        quoteMacro: row.quoteMacroCount || 0
      }
    };
  } catch (err) {
      console.error("Error fetching user stats:", err);
      // Re-throw the error so the calling function knows something went wrong.
      throw err;
  }
};

// USER STATS IN DATABASE
export const updateUserStatsInDB = async (userId, chatGroupId, stats) => {
  // INSERT OR UPDATE USER STATS
  const query = `
    INSERT INTO user_activity (userId, chatGroupId, totalPoints, level, messageCount, reactionCount, threadCount, voiceRoomMinutes, quoteMacroCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    totalPoints = VALUES(totalPoints),
    level = VALUES(level),
    messageCount = VALUES(messageCount),
    reactionCount = VALUES(reactionCount),
    threadCount = VALUES(threadCount),
    voiceRoomMinutes = VALUES(voiceRoomMinutes),
    quoteMacroCount = VALUES(quoteMacroCount);
  `;
  
  const values = [
    userId, chatGroupId,
    stats.totalPoints,
    stats.level,
    stats.activityCounts.message || 0,
    stats.activityCounts.reaction || 0,
    stats.activityCounts.thread || 0,
    stats.activityCounts.voiceRoom || 0,
    stats.activityCounts.quoteMacro || 0,
  ];
  
  try {
    const [result] = await db.promise().query(query, values);
    return result;
  } catch (err) {
      console.error("Error updating user stats in DB:", err);
      throw err;
  }
};

// HANDLE LEVEL UP
export const handleLevelUp = async (userId, chatGroupId, newLevel) => {
  const query = `
    INSERT INTO user_level_history
    (userId, chatGroupId, newLevel, achievedAt)
    VALUES (?, ?, ?, NOW())
  `;
  
  await new Promise((resolve, reject) => {
    db.query(query, [userId, chatGroupId, newLevel], (err, result) => {
      if (err) {
        console.error("Error logging level up:", err);
        return reject(err);
      }
      
      resolve(result);
    });
  });
  
  // PUBLISH LEVEL UP EVENT
  publishEvent('user.levelup', {
    userId,
    chatGroupId,
    newLevel,
    timestamp: Date.now()
  });
  
  return { userId, chatGroupId, newLevel };
};

// GET GROUP LEADERBOARD
export const getGroupLeaderboard = async (chatGroupId) => { 
  const query = `
    SELECT 
      cgm.userId,
      u.full_name,
      u.profilePic,
      COALESCE(ua.level, 1) AS level,
      COALESCE(ua.totalPoints, 0) AS totalPoints
    FROM chat_group_members cgm
    JOIN users u ON cgm.userId = u.id
    LEFT JOIN user_activity ua ON cgm.userId = ua.userId AND cgm.chatGroupId = ua.chatGroupId
    WHERE cgm.chatGroupId = ?
    ORDER BY level DESC, totalPoints DESC
  `;
  
  return new Promise((resolve, reject) => {
    db.query(query, [chatGroupId], (err, results) => { 
      if (err) {
        console.error("Error fetching leaderboard:", err);
        return reject(err);
      }
      
      resolve(results);
    });
  });
};

// GET USER LEVEL PROGRESS
export const getUserLevelProgress = async (userId, chatGroupId) => { 
  const stats = await getUserStats(userId, chatGroupId);
  
  // CALCULATE LEVEL PROGRESS
  const currentLevel = stats.level;
  const currentLevelThreshold = LEVEL_THRESHOLDS[currentLevel - 1];
  let nextLevelThreshold = LEVEL_THRESHOLDS[currentLevel];
  
  if (!nextLevelThreshold) {
    return {
      level: currentLevel,
      totalPoints: stats.totalPoints,
      currentLevelThreshold,
      nextLevelThreshold: currentLevelThreshold,
      progressToNextLevel: 100,
      isMaxLevel: true
    };
  }
  
  const pointsInCurrentLevel = stats.totalPoints - currentLevelThreshold;
  const pointsNeededForNextLevel = nextLevelThreshold - currentLevelThreshold;
  const progressPercentage = Math.min(
    Math.floor((pointsInCurrentLevel / pointsNeededForNextLevel) * 100),
    99
  );
  
  return {
    level: currentLevel,
    totalPoints: stats.totalPoints,
    currentLevelThreshold,
    nextLevelThreshold,
    progressToNextLevel: progressPercentage,
    pointsNeededForNextLevel: nextLevelThreshold - stats.totalPoints,
    isMaxLevel: false
  };
}; 