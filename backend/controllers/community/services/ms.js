import { db } from "../../../config/connectDB.js";
import { redisClient } from "../../../config/redisConfig.js";

import { processImageUrl } from "../../../middlewares/cloudfrontConfig.js";

// CENTRALIZED HELPER TO PROCESS MESSAGE MEDIA
const processMessageMedia = (message) => {
    if (!message) return null;

    message.profilePic = processImageUrl(message.profilePic);
    message.audio = processImageUrl(message.audio);
    if (message.media) {
        message.mediaUrls = message.media.split(',').map(key => processImageUrl(key.trim()));
    } else {
        message.mediaUrls = [];
    }

    // Parse mentions 
    try {
        message.mentionedUsers = message.mentions ? JSON.parse(message.mentions) : [];
    } catch (e) {
        console.error(`[Message] Failed to parse mentions for message ${message.id}:`, e);
        message.mentionedUsers = [];
    }

    return message;
};

// SAVE MESSAGE TO DB
export const saveMessage = async (messageData) => {
    try {
        const query = `
            INSERT INTO groupmessages (userId, chatGroupId, text, media, createdAt, replyToMessageId, audio, threadId, spoiler, mentions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const values = [
            messageData.userId, messageData.chatGroupId, messageData.text,
            messageData.media, messageData.createdAt, messageData.replyToMessageId,
            messageData.audio, messageData.threadId, messageData.spoiler ? 1 : 0,
            messageData.mentions
        ];
        
        const [result] = await db.promise().query(query, values);
        console.log(`[DB Service] Message saved successfully. Insert ID: ${result.insertId}`);
        return { id: result.insertId, ...messageData };
    } catch (err) {
        console.error("[DB Service] Error saving message to database:", err);
        throw err; 
    }
};

// GET USER PROFILE BY ID
export const getUserInfo = async (userId) => {
    try {
        const cacheKey = `user:${userId}`;
        const cachedUser = await redisClient.get(cacheKey);
        if (cachedUser) {
            let user = JSON.parse(cachedUser);
            user.profilePic = processImageUrl(user.profilePic); // Process even if cached
            return user;
        }

        const query = `
            SELECT id, full_name, username, profilePic,
                   SUBSTRING_INDEX(full_name, ' ', 1) as firstName,
                   SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 2) as lastName
            FROM users WHERE id = ?;
        `;
        const [results] = await db.promise().query(query, [userId]);
        if (results.length === 0) {
            console.warn(`[DB Service] User ${userId} not found in database.`);
            return null;
        }

        let user = results[0];
        user.profilePic = processImageUrl(user.profilePic);

        redisClient.set(cacheKey, JSON.stringify(user), 'EX', 300)
            .catch(cacheErr => console.error(`[Redis] Error caching user ${userId}:`, cacheErr));

        return user;
    } catch (err) {
        console.error(`[DB Service] Error fetching user ${userId} from database:`, err);
        throw err;
    }
};

// GET MESSAGE BY ID
export const getMessageById = async (messageId) => {
    try {
        const cacheKey = `message:${messageId}`;
        const cachedMessage = await redisClient.get(cacheKey);
        if (cachedMessage) {
            let message = JSON.parse(cachedMessage);
            return processMessageMedia(message); // Re-process media URLs
        }
        
        const query = `
            SELECT m.*, m.chatGroupId AS groupId, u.full_name, u.profilePic
            FROM groupmessages m
            INNER JOIN users u ON m.userId = u.id
            WHERE m.id = ?;
        `;
        const [results] = await db.promise().query(query, [messageId]);
        if (results.length === 0) {
            console.warn(`[DB Service] Message ${messageId} not found in database.`);
            return null;
        }
        
        let message = processMessageMedia(results[0]);

        redisClient.set(cacheKey, JSON.stringify(message), 'EX', 300)
            .catch(cacheErr => console.error(`[Redis] Error caching message ${messageId}:`, cacheErr));

        return message;
    } catch (err) {
        console.error(`[DB Service] Error fetching message ${messageId}:`, err);
        throw err;
    }
};

// SAVE A REACTION TO THE DB 
export const saveReaction = async (reactionData) => {
    try {
        const query = `INSERT INTO message_reactions (userId, messageId, reactionType, customEmote, createdAt) VALUES (?, ?, ?, ?, ?);`;
        const values = [reactionData.userId, reactionData.messageId, reactionData.reactionType, reactionData.customEmote, reactionData.createdAt];
        const [result] = await db.promise().query(query, values);
        return { id: result.insertId, ...reactionData };
    } catch (err) {
        console.error("[DB Service] Error saving reaction to database:", err);
        throw err;
    }
};

// CREATE NEW THREAD
export const createThread = async (threadData) => {
    try {
        const query = `INSERT INTO message_threads (parentMessageId, creatorId, chatGroupId, createdAt) VALUES (?, ?, ?, ?);`;
        const values = [threadData.parentMessageId, threadData.creatorId, threadData.chatGroupId, threadData.createdAt];
        const [result] = await db.promise().query(query, values);
        return { id: result.insertId, ...threadData };
    } catch (err) {
        console.error("[DB Service] Error creating thread in database:", err);
        throw err;
    }
};

// ADD MESSAGE TO THREAD
export const addMessageToThread = async (threadId, messageId) => {
    try {
        const query = `UPDATE groupmessages SET threadId = ? WHERE id = ?;`;
        const [result] = await db.promise().query(query, [threadId, messageId]);
        return result;
    } catch (err) {
        console.error("[DB Service] Error adding message to thread:", err);
        throw err;
    }
};

// GET MESSAGES IN THREAD
export const getThreadMessages = async (threadId) => {
    try {
        const query = `
            SELECT m.*, m.chatGroupId AS groupId, u.full_name, u.profilePic
            FROM groupmessages m
            INNER JOIN users u ON m.userId = u.id
            WHERE m.threadId = ?
            ORDER BY m.createdAt ASC;
        `;
        const [results] = await db.promise().query(query, [threadId]);
        return results.map(message => processMessageMedia(message));
    } catch (err) {
        console.error("[DB Service] Error fetching thread messages:", err);
        throw err;
    }
};

// Parse mentions from a message
export const parseMentions = (messageText) => {
    if (!messageText) return [];
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
    return mentions;
};