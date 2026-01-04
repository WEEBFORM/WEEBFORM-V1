import { db } from "../../../config/connectDB.js";
import { redisClient } from "../../../config/redisConfig.js";
import { generateS3Url, s3KeyFromUrl } from "../../../middlewares/S3bucketConfig.js";

// PROCESS PROFILE PICTURE TO ENSURE IT'S A VALID S3 URL
const processProfilePicture = async (userObject) => {
    if (userObject && userObject.profilePic) {
        if (userObject.profilePic.startsWith('http')) {
            return userObject;
        }
        try {
            const profilePicKey = s3KeyFromUrl(userObject.profilePic);
            userObject.profilePic = await generateS3Url(profilePicKey);
        } catch (s3Err) {
            console.warn(`[S3] Error generating S3 URL for profilePic (key: ${userObject.profilePic}):`, s3Err.message);
            userObject.profilePic = null; // Default to null on error
        }
    }
    return userObject;
};


//SAVE MESSAGE TO DB
export const saveMessage = async (messageData) => {
  console.log(`[DB Service] Attempting to save message for userId: ${messageData.userId}, chatGroupId: ${messageData.chatGroupId}`);
  const query = `
    INSERT INTO groupmessages
    (userId, chatGroupId, text, media, createdAt, replyToMessageId, audio, threadId, spoiler, mentions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    messageData.userId,
    messageData.chatGroupId,
    messageData.text,
    messageData.media,
    messageData.createdAt,
    messageData.replyToMessageId,
    messageData.audio,
    messageData.threadId,
    messageData.spoiler ? 1 : 0,
    messageData.mentions
  ];

  return new Promise((resolve, reject) => {
    db.query(query, values, (err, result) => {
      if (err) {
        console.error("[DB Service] Error saving message to database:", err);
        return reject(err);
      }
      console.log(`[DB Service] Message saved successfully. Insert ID: ${result.insertId}`);
      resolve({
        id: result.insertId,
        ...messageData
      });
    });
  });
};

//GET USER PROFILE BY id
export const getUserInfo = async (userId) => {
  console.log(`[DB Service] Attempting to fetch user info for ID: ${userId}`);
  const cachedUser = await redisClient.get(`user:${userId}`);
  if (cachedUser) {
    console.log(`[Redis] User ${userId} found in cache.`);
    let user = JSON.parse(cachedUser);
    user = await processProfilePicture(user);
    return user;
  }
  console.log(`[DB Service] User ${userId} not in cache, fetching from database.`);
  const query = `
    SELECT id, full_name, username, profilePic,
    SUBSTRING_INDEX(full_name, ' ', 1) as firstName,
    SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 2) as lastName
    FROM users WHERE id = ?`;

  return new Promise((resolve, reject) => {
    db.query(query, [userId], async (err, results) => {
      if (err) {
        console.error("[DB Service] Error fetching user from database:", err);
        return reject(err);
      }

      if (!results || results.length === 0) {
        console.warn(`[DB Service] User ${userId} not found in database.`);
        return resolve(null);
      }

      let user = results[0];
      user = await processProfilePicture(user);
      // CACHE USER INFO
      redisClient.set(`user:${userId}`, JSON.stringify(user), 'EX', 300)
        .catch(cacheErr => console.error(`[Redis] Error caching user ${userId}:`, cacheErr));
      
      resolve(user);
    });
  });
};


//GET MESSAGE BY id
export const getMessageById = async (messageId) => {
  console.log(`[DB Service] Fetching message by ID: ${messageId}`);
  const cachedMessage = await redisClient.get(`message:${messageId}`);
  if (cachedMessage) {
    console.log(`[Redis] Message ${messageId} found in cache.`);
    let message = JSON.parse(cachedMessage);
    message = await processProfilePicture(message);
    return message;
  }

  const query = `
    SELECT
        m.id, m.userId, m.chatGroupId AS groupId, m.text, m.media,
        m.createdAt, m.replyToMessageId, m.audio, m.threadId,
        m.spoiler, m.mentions, u.full_name, u.profilePic,
        SUBSTRING_INDEX(u.full_name, ' ', 1) as firstName,
        SUBSTRING(u.full_name, LENGTH(SUBSTRING_INDEX(u.full_name, ' ', 1)) + 2) as lastName
    FROM groupmessages m
    INNER JOIN users u ON m.userId = u.id
    WHERE m.id = ?
  `;

  return new Promise((resolve, reject) => {
    db.query(query, [messageId], async (err, results) => {
      if (err) {
        console.error("[DB Service] Error fetching message from database:", err);
        return reject(err);
      }

      if (!results || results.length === 0) {
        console.warn(`[DB Service] Message ${messageId} not found in database.`);
        return resolve(null);
      }

      let message = results[0];
      console.log(`[DB Service] Message ${messageId} fetched successfully.`);

      message = await processProfilePicture(message);

      // PARSE MEDIA URLs
      message.mediaUrls = message.media ? message.media.split(',') : [];

      // PARSE MENTIONS
      try {
          message.mentionedUsers = message.mentions ? JSON.parse(message.mentions) : [];
      } catch (e) {
          console.error(`[Message] Failed to parse mentions for message ${message.id}:`, e);
          message.mentionedUsers = [];
      }

      // CACHE MESSAGE
      redisClient.set(`message:${messageId}`, JSON.stringify(message), 'EX', 300)
        .catch(cacheErr => console.error(`[Redis] Error caching message ${messageId}:`, cacheErr));

      resolve(message);
    });
  });
};

//GET MESSAGES IN THREAD (FUTUTRE USE)
export const getThreadMessages = async (threadId) => {
  console.log(`[DB Service] Fetching messages for thread ID: ${threadId}`);
  const query = `
    SELECT
        m.id, m.userId, m.chatGroupId AS groupId, m.text, m.media,
        m.createdAt, m.replyToMessageId, m.audio, m.threadId,
        m.spoiler, m.mentions, u.full_name, u.profilePic,
        SUBSTRING_INDEX(u.full_name, ' ', 1) as firstName,
        SUBSTRING(u.full_name, LENGTH(SUBSTRING_INDEX(u.full_name, ' ', 1)) + 2) as lastName
    FROM groupmessages m
    INNER JOIN users u ON m.userId = u.id
    WHERE m.threadId = ?
    ORDER BY m.createdAt ASC
  `;

  return new Promise((resolve, reject) => {
    db.query(query, [threadId], async (err, results) => {
      if (err) {
        console.error("[DB Service] Error fetching thread messages from database:", err);
        return reject(err);
      }
      console.log(`[DB Service] Fetched ${results.length} messages for thread ${threadId}.`);

      const messages = await Promise.all(results.map(async (message) => {
        let processedMessage = await processProfilePicture(message);

        processedMessage.mediaUrls = processedMessage.media ? processedMessage.media.split(',') : [];

        // PARSE MENTIONS
        try {
            processedMessage.mentionedUsers = processedMessage.mentions ? JSON.parse(processedMessage.mentions) : [];
        } catch (e) {
            console.error(`[Message] Failed to parse mentions for thread message ${processedMessage.id}:`, e);
            processedMessage.mentionedUsers = [];
        }

        return processedMessage;
      }));

      resolve(messages);
    });
  });
};

// SAVE A REACTION TO THE DB 
export const saveReaction = async (reactionData) => {
  console.log(`[DB Service] Attempting to save reaction for userId: ${reactionData.userId}, messageId: ${reactionData.messageId}`);
  const query = `
    INSERT INTO message_reactions
    (userId, messageId, reactionType, customEmote, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `;

  const values = [
    reactionData.userId,
    reactionData.messageId,
    reactionData.reactionType,
    reactionData.customEmote,
    reactionData.createdAt
  ];

  return new Promise((resolve, reject) => {
    db.query(query, values, (err, result) => {
      if (err) {
        console.error("[DB Service] Error saving reaction to database:", err);
        return reject(err);
      }
      console.log(`[DB Service] Reaction saved successfully. Insert ID: ${result.insertId}`);
      resolve({
        id: result.insertId,
        ...reactionData
      });
    });
  });
};

//CREATE NEW THREAD
export const createThread = async (threadData) => {
  console.log(`[DB Service] Attempting to create thread for parentMessageId: ${threadData.parentMessageId}`);
  const query = `
    INSERT INTO message_threads
    (parentMessageId, creatorId, chatGroupId, createdAt)
    VALUES (?, ?, ?, ?)
  `;

  const values = [
    threadData.parentMessageId,
    threadData.creatorId,
    threadData.chatGroupId,
    threadData.createdAt
  ];

  return new Promise((resolve, reject) => {
    db.query(query, values, (err, result) => {
      if (err) {
        console.error("[DB Service] Error creating thread in database:", err);
        return reject(err);
      }
      console.log(`[DB Service] Thread created successfully. Insert ID: ${result.insertId}`);
      resolve({
        id: result.insertId,
        ...threadData
      });
    });
  });
};

//ADD MESSAGE TO THREAD
export const addMessageToThread = async (threadId, messageId) => {
  console.log(`[DB Service] Attempting to add message ${messageId} to thread ${threadId}.`);
  const query = `
    UPDATE groupmessages
    SET threadId = ?
    WHERE id = ?
  `;

  return new Promise((resolve, reject) => {
    db.query(query, [threadId, messageId], (err, result) => {
      if (err) {
        console.error("[DB Service] Error adding message to thread:", err);
        return reject(err);
      }
      console.log(`[DB Service] Message ${messageId} linked to thread ${threadId}. Rows affected: ${result.affectedRows}`);
      resolve(result);
    });
  });
};


// PARSE MENTIONS IN MESSAGE TEXT
export const parseMentions = (messageText) => {
  if (!messageText) return [];

  // Pattern to match: @[User Name](userId)
  const mentionPattern = /@\[([^\]]+)]\(([^)]+)\)/g;

  const mentions = [];
  let match;

  while ((match = mentionPattern.exec(messageText)) !== null) {
    mentions.push({
      userId: match[2].trim(),
      name: match[1].trim(),
      fullMatch: match[0]
    });
  }

  console.log(`[Message] Parsed ${mentions.length} mention(s):`, mentions);
  return mentions;
};