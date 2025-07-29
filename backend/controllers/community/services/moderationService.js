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

// TOGGLE SLOW MODE FOR A SPECIFIC USER (admin action)
export const toggleUserSlowMode = async (targetUserId, chatGroupId, duration, adminId) => { 
  const userSlowModeKey = `slowmode:${chatGroupId}:${targetUserId}`;
  const isSlowModeActive = await redisClient.get(userSlowModeKey);
  let actionPerformed;
  let logAction;

  if (isSlowModeActive) {
    // Unapply slow mode
    await redisClient.del(userSlowModeKey);
    actionPerformed = false;
    logAction = 'remove_slow_mode';
    console.log(`[Moderation] Removed slow mode for user ${targetUserId} in chat group ${chatGroupId}.`); 
  } else {
    // Apply slow mode
    if (!duration || duration <= 0) {
        throw new Error("Duration is required to apply slow mode.");
    }
    await redisClient.set(userSlowModeKey, '1', 'EX', duration);
    actionPerformed = true;
    logAction = 'apply_slow_mode';
    console.log(`[Moderation] Applied slow mode for user ${targetUserId} in chat group ${chatGroupId} for ${duration}s.`); 
  }

  // LOG MODERATION ACTION
  const logQuery = `
    INSERT INTO moderation_actions
    (adminId, targetUserId, chatGroupId, action, duration, createdAt)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  db.query(logQuery, [adminId, targetUserId, chatGroupId, logAction, duration], (err) => {
    if (err) console.error("[DB Service] Error logging slow mode moderation action:", err);
  });
  
  // Publish event
  publishEvent('user.slowmode.toggled', {
    userId: targetUserId,
    chatGroupId,
    isSlowModeActive: actionPerformed,
    duration,
    adminId,
    timestamp: Date.now()
  });
  console.log(`[EventBus] Published 'user.slowmode.toggled' event: ${logAction}.`);

  return { success: true, userId: targetUserId, chatGroupId, isSlowModeActive: actionPerformed, duration };
};

// TOGGLE GROUP SLOW MODE (admin action)
export const toggleGroupSlowMode = async (chatGroupId, duration, adminId) => { // Added adminId for logging
  const groupSlowModeKey = `slowmode:${chatGroupId}:group_wide`; // Use a distinct key for group-wide slow mode
  const isGroupSlowModeActive = await redisClient.get(groupSlowModeKey);
  let actionPerformed;
  let logAction;

  if (isGroupSlowModeActive) {
    // Disable group-wide slow mode
    await redisClient.del(groupSlowModeKey);
    actionPerformed = false;
    logAction = 'disable_group_slow_mode';
    console.log(`[Moderation] Disabled group-wide slow mode for group ${chatGroupId}.`); 
  } else {
    // Enable group-wide slow mode
    if (!duration || duration <= 0) {
        throw new Error("Duration is required to enable group slow mode.");
    }
    await redisClient.set(groupSlowModeKey, duration, 'EX', duration); // Store duration in Redis, set expiration
    actionPerformed = true;
    logAction = 'enable_group_slow_mode';
    console.log(`[Moderation] Enabled group slow mode for group ${chatGroupId} for ${duration}s.`);
  }

  // LOG MODERATION ACTION
  const logQuery = `
    INSERT INTO moderation_actions
    (adminId, targetUserId, chatGroupId, action, duration, createdAt)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  // targetUserId is null for group-wide actions
  db.query(logQuery, [adminId, null, chatGroupId, logAction, duration], (err) => {
    if (err) console.error("[DB Service] Error logging group slow mode moderation action:", err);
  });
  
  // Publish event
  publishEvent('group.slowmode.toggled', {
    chatGroupId,
    isGroupSlowModeActive: actionPerformed,
    duration,
    adminId,
    timestamp: Date.now()
  });
  console.log(`[EventBus] Published 'group.slowmode.toggled' event: ${logAction}.`);

  return { success: true, chatGroupId, isGroupSlowModeActive: actionPerformed, duration };
};

// TOGGLE MUTE USER IN GROUP (admin action)
export const toggleUserMute = async (targetUserId, chatGroupId, duration, adminId) => { 
  const muteKey = `mute:${chatGroupId}:${targetUserId}`;
  const isMuted = await redisClient.get(muteKey);
  let actionPerformed;
  let logAction;

  if (isMuted) {
    // Unmute user
    await redisClient.del(muteKey);
    actionPerformed = false;
    logAction = 'unmute';
    console.log(`[Moderation] Unmuted user ${targetUserId} in chat group ${chatGroupId}.`); 
  } else {
    // Mute user
    if (!duration || duration <= 0) {
        throw new Error("Duration is required to mute user.");
    }
    await redisClient.set(muteKey, '1', 'EX', duration);
    actionPerformed = true;
    logAction = 'mute';
    console.log(`[Moderation] Muted user ${targetUserId} in chat group ${chatGroupId} for ${duration}s.`); 
  }

  // LOG MODERATION ACTION
  const logQuery = `
    INSERT INTO moderation_actions
    (adminId, targetUserId, chatGroupId, action, duration, createdAt)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  db.query(logQuery, [adminId, targetUserId, chatGroupId, logAction, duration], (err) => {
    if (err) console.error("[DB Service] Error logging mute moderation action:", err);
  });
  
  // PUBLISH EVENT
  publishEvent('user.muted.toggled', {
    userId: targetUserId,
    chatGroupId,
    isMuted: actionPerformed,
    duration,
    adminId,
    timestamp: Date.now()
  });
  console.log(`[EventBus] Published 'user.muted.toggled' event: ${logAction}.`);

  return { success: true, userId: targetUserId, chatGroupId, isMuted: actionPerformed, duration };
};

// TOGGLE EXILE USER TO FILLER ROOM (admin action)
export const toggleUserExile = async (targetUserId, chatGroupId, duration, adminId) => {
  const exileKey = `exile:${chatGroupId}:${targetUserId}`;
  const isExiled = await redisClient.get(exileKey);
  let actionPerformed;
  let logAction;

  if (isExiled) {
    // Unexile user
    await redisClient.del(exileKey);
    actionPerformed = false;
    logAction = 'unexile';
    console.log(`[Moderation] Unexiled user ${targetUserId} from chat group ${chatGroupId}.`);
  } else {
    // Exile user
    if (!duration || duration <= 0) {
        throw new Error("Duration is required to exile user.");
    }
    await redisClient.set(exileKey, '1', 'EX', duration); 
    actionPerformed = true;
    logAction = 'exile';
    console.log(`[Moderation] Exiled user ${targetUserId} to filler room in chat group ${chatGroupId} for ${duration}s.`);
  }

  // LOG MODERATION ACTION
  const logQuery = `
    INSERT INTO moderation_actions
    (adminId, targetUserId, chatGroupId, action, duration, createdAt)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  db.query(logQuery, [adminId, targetUserId, chatGroupId, logAction, duration], (err) => {
    if (err) console.error("[DB Service] Error logging exile moderation action:", err);
  });
  
  //PUBLISH EVENT
  publishEvent('user.exiled.toggled', {
    userId: targetUserId, 
    chatGroupId, 
    isExiled: actionPerformed,
    duration,
    adminId,
    timestamp: Date.now()
  });
  console.log(`[EventBus] Published 'user.exiled.toggled' event: ${logAction}.`);

  return { success: true, userId: targetUserId, chatGroupId, isExiled: actionPerformed, duration };
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
      if (result.affectedRows === 0) {
        // User was already not a member, or invalid userId/chatGroupId
        return resolve({ success: false, message: "User not found in group or already removed." });
      }
      console.log(`[DB Service] User ${userId} removed from chat group ${chatGroupId}. Rows affected: ${result.affectedRows}`); 
      
      // Clear any active moderation for this user in this specific chat group
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

      return resolve({ success: true, userId, chatGroupId, message: "User removed from group." });
    });
  });
}; 