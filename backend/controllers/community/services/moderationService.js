import { db } from "../../../config/connectDB.js";
import { redisClient } from "../../../config/redisConfig.js";
import { publishEvent } from "./eventBus.js";

// VERIFY ADMIN STATUS
export const getGroupAdminInfo = async (userId, chatGroupId) => {
  console.log(`[Moderation] Checking admin status for user ${userId} in chat group ${chatGroupId}.`);
  
  const cacheKey = `admin:${chatGroupId}:${userId}`;
  const cachedAdminStatus = await redisClient.get(cacheKey);

  if (cachedAdminStatus !== null) {
    console.log(`[Redis] Admin status for user ${userId} in chat group ${chatGroupId} found in cache: ${cachedAdminStatus}`);
    return cachedAdminStatus === 'true';
  }

  try {
    // FIND COMMUNITY GROUP BELONGS TO
    const [groupInfo] = await db.promise().query("SELECT communityId FROM `chat_groups` WHERE id = ?", [chatGroupId]);
    if (groupInfo.length === 0) {
      console.warn(`[Moderation] Chat group ${chatGroupId} not found.`);
      return false; 
    }
    const communityId = groupInfo[0].communityId;

    // VERIFY COMMUNITY ADMIN STATUS
    const [results] = await db.promise().query("SELECT isAdmin FROM community_members WHERE communityId = ? AND userId = ? AND isAdmin = 1", [communityId, userId]);

    const isAdmin = results.length > 0;
    console.log(`[DB Service] Admin status for user ${userId} in community ${communityId} (via chat group ${chatGroupId}): ${isAdmin}.`);

    redisClient.set(cacheKey, String(isAdmin), 'EX', 300)
      .then(() => console.log(`[Redis] Cached admin status for user ${userId} in chat group ${chatGroupId}.`))
      .catch(cacheErr => console.error(`[Redis] Error caching admin status for user ${userId}:`, cacheErr));

    return isAdmin;
  } catch (err) {
    console.error("[DB Service] Error checking admin status in database:", err);
    throw new Error("Database error checking admin status."); 
  }
};

// CHECK USER PERMISSIONS IN A CHAT GROUP
export const checkUserPermissions = async (userId, chatGroupId, action) => { 
  console.log(`[Moderation] Checking permissions for user ${userId} in chat group ${chatGroupId} for action '${action}'.`);
  // MUTED?
  const isMuted = await redisClient.get(`mute:${chatGroupId}:${userId}`); 
  if (isMuted) {
    console.log(`[Moderation] User ${userId} is muted in group ${chatGroupId}.`);
    if (action === 'sendMessage' || action === 'sendReaction') {
      return false;
    }
  }

  // EXILED TO FILLER ROOM?
  const isExiled = await redisClient.get(`exile:${chatGroupId}:${userId}`); 
  if (isExiled) {
    console.log(`[Moderation] User ${userId} is exiled in group ${chatGroupId}.`);
    return false; 
  }

  // VERIFY MEMBERSHIP
  const query = `
    SELECT id FROM chat_group_members
    WHERE userId = ? AND chatGroupId = ?
  `;

  return new Promise((resolve, reject) => {
    db.query(query, [userId, chatGroupId], (err, results) => { 
      if (err) {
        console.error("[DB Service] Error checking user membership permissions:", err);
        return reject(err);
      }
      const isMember = results.length > 0;
      console.log(`[DB Service] User ${userId} is member of chat group ${chatGroupId}: ${isMember}.`);
      resolve(isMember);
    });
  });
};

// APPLY SLOW MODE TO GROUP (admin action)
export const applySlowMode = async (userId, chatGroupId, duration, adminId) => { 
  console.log(`[Moderation] Applying slow mode for user ${userId} in chat group ${chatGroupId} for ${duration}s.`); 
  //APPLY SLOW MODE
  await redisClient.set(`slowmode:${chatGroupId}:${userId}`, '1', 'EX', duration);
  console.log(`[Redis] Slow mode set for user ${userId} in chat group ${chatGroupId}.`); 
  // Publish event
  publishEvent('user.slowmode.applied', {
    userId,
    chatGroupId,
    duration,
    timestamp: Date.now()
  });
  console.log(`[EventBus] Published 'user.slowmode.applied' event.`);
  //LOG MODERATION ACTION
  if (adminId) {
    const logQuery = `
      INSERT INTO moderation_actions
      (adminId, targetUserId, chatGroupId, action, duration, createdAt)
      VALUES (?, ?, ?, 'slow_mode', ?, NOW())
    `;
    db.query(logQuery, [adminId, userId, chatGroupId, duration], (err) => {
      if (err) console.error("[DB Service] Error logging slow mode moderation action:", err);
    });
  }

  return { success: true, userId, chatGroupId, duration };
};

// TOGGLE GROUP SLOW MODE (admin action)
export const toggleGroupSlowMode = async (chatGroupId, duration) => {
  console.log(`[Moderation] Toggling group slow mode for group ${chatGroupId}. Duration: ${duration || 'disabled'}.`); 
  if (!duration) {
    // Disable slow mode
    await redisClient.del(`slowmode:${chatGroupId}`);
    console.log(`[Redis] Group slow mode disabled for group ${chatGroupId}.`); 
    return { enabled: false, chatGroupId };
  } else {
    await redisClient.set(`slowmode:${chatGroupId}`, duration);
    console.log(`[Redis] Group slow mode enabled for group ${chatGroupId} for ${duration}s.`);
    return { enabled: true, chatGroupId, duration };
  }
};

//TEMPORARILY MUTE USER IN GROUP (admin action)
export const temporarilyMuteUser = async (userId, chatGroupId, duration, adminId) => { 
  console.log(`[Moderation] Temporarily muting user ${userId} in chat group ${chatGroupId} for ${duration}s.`); 
  await redisClient.set(`mute:${chatGroupId}:${userId}`, '1', 'EX', duration);
  console.log(`[Redis] Mute set for user ${userId} in chat group ${chatGroupId}.`);

  // LOG MODERATION ACTION
  const query = `
    INSERT INTO moderation_actions
    (adminId, targetUserId, chatGroupId, action, duration, createdAt)
    VALUES (?, ?, ?, 'mute', ?, NOW())
  `;

  return new Promise((resolve, reject) => {
    db.query(query, [adminId, userId, chatGroupId, duration], (err, result) => {
      if (err) {
        console.error("[DB Service] Error logging mute moderation action:", err);
        return reject(err);
      }
      console.log(`[DB Service] Mute action logged for user ${userId} in chat group ${chatGroupId}.`); 
      
      //PUBLISH EVENT
      publishEvent('user.muted', {
        userId,
        chatGroupId,
        duration,
        timestamp: Date.now()
      });
      console.log(`[EventBus] Published 'user.muted' event.`);

      return resolve({ success: true, userId, chatGroupId, duration });
    });
  });
};

//EXILE USER TO FILLER ROOM (admin action)
export const exileUserToFillerRoom = async (userId, chatGroupId, duration, adminId) => {
  console.log(`[Moderation] Exiling user ${userId} to filler room in chat group ${chatGroupId} for ${duration}s.`);
  await redisClient.set(`exile:${chatGroupId}:${userId}`, '1', 'EX', duration); 
  console.log(`[Redis] Exile status set for user ${userId} in chat group ${chatGroupId}.`);
  // LOG MODERATION ACTION
  const query = `
    INSERT INTO moderation_actions
    (adminId, targetUserId, chatGroupId, action, duration, createdAt)
    VALUES (?, ?, ?, 'exile', ?, NOW())
  `;

  return new Promise((resolve, reject) => {
    db.query(query, [adminId, userId, chatGroupId, duration], (err, result) => { 
      if (err) {
        console.error("[DB Service] Error logging exile moderation action:", err);
        return reject(err);
      }
      console.log(`[DB Service] Exile action logged for user ${userId} in chat group ${chatGroupId}.`); 
      //PUBLISH EVENT
      publishEvent('user.exiled', {
        userId, 
        chatGroupId, 
        duration,
        timestamp: Date.now()
      });
      console.log(`[EventBus] Published 'user.exiled' event.`);

      return resolve({ success: true, userId, chatGroupId, duration });
    });
  });
};

export const removeUserFromGroup = async (userId, chatGroupId, adminId) => {
  console.log(`[Moderation] Removing user ${userId} from chat group ${chatGroupId}.`);
  // REMOVE USER FROM GROUP MEMBERS
  const query = `
    DELETE FROM chat_group_members
    WHERE userId = ? AND chatGroupId = ?
  `;

  return new Promise((resolve, reject) => {
    db.query(query, [userId, chatGroupId], (err, result) => { 
      if (err) {
        console.error("[DB Service] Error removing user from chat group members:", err);
        return reject(err);
      }
      console.log(`[DB Service] User ${userId} removed from chat group ${chatGroupId}. Rows affected: ${result.affectedRows}`); 
      redisClient.del(`mute:${chatGroupId}:${userId}`)
        .then(() => console.log(`[Redis] Cleared mute status for ${userId} in ${chatGroupId}.`))
        .catch(err => console.error(`[Redis] Error clearing mute status for ${userId} in ${chatGroupId}:`, err));
      redisClient.del(`exile:${chatGroupId}:${userId}`)
        .then(() => console.log(`[Redis] Cleared exile status for ${userId} in ${chatGroupId}.`))
        .catch(err => console.error(`[Redis] Error clearing exile status for ${userId} in ${chatGroupId}:`, err));
      redisClient.del(`slowmode:${chatGroupId}:${userId}`)
        .then(() => console.log(`[Redis] Cleared slowmode status for ${userId} in ${chatGroupId}.`))
        .catch(err => console.error(`[Redis] Error clearing slowmode status for ${userId} in ${chatGroupId}:`, err));
      redisClient.del(`admin:${chatGroupId}:${userId}`)
        .then(() => console.log(`[Redis] Cleared admin status cache for ${userId} in ${chatGroupId}.`))
        .catch(err => console.error(`[Redis] Error clearing admin cache for ${userId} in ${chatGroupId}:`, err));


      // LOG MODERATION ACTION
      const logQuery = `
        INSERT INTO moderation_actions
        (adminId, targetUserId, chatGroupId, action, duration, createdAt)
        VALUES (?, ?, ?, 'remove', NULL, NOW())
      `;
      db.query(logQuery, [adminId, userId, chatGroupId], (err, result) => { 
        if (err) {
          console.error("[DB Service] Error logging remove moderation action:", err);
        } else {
          console.log(`[DB Service] Remove action logged for user ${userId} from chat group ${chatGroupId}.`); 
        }
      });

      // PUBLISH EVENT
      publishEvent('user.removed', {
        userId, 
        chatGroupId, 
        timestamp: Date.now()
      });
      console.log(`[EventBus] Published 'user.removed' event.`);

      return resolve({ success: true, userId, chatGroupId });
    });
  });
};