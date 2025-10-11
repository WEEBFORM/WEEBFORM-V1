import { Server } from "socket.io";
import moment from "moment";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../../../middlewares/S3bucketConfig.js";
import { authenticateSocket } from "../../../middlewares/socketVerification.js";
import { publishEvent } from "../services/eventBus.js";
import {
  saveMessage,
  getUserInfo,
  saveReaction,
  createThread as createThreadService,
  addMessageToThread,
  getThreadMessages,
  parseMentions,
  getMessageById
} from "../services/messageService.js";
import {
  getGroupAdminInfo,
  checkUserPermissions,
  toggleUserSlowMode,
  toggleUserMute,
  toggleUserExile,
  removeUserFromGroup
} from "../services/moderationService.js";
import { incrementUserActivity } from "../services/gamificationService.js";
import { REACTION_TYPES, ADMIN_ACTIONS } from "../constants/index.js";
import { redisClient } from "../../../config/redisConfig.js";
import { processImageUrl } from '../../../middlewares/cloudfrontConfig.js';
import { db } from "../../../config/connectDB.js";

const typingUsers = new Map();

export const initializeMessageSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['*', 'http://localhost:3001', 'http://localhost:3002', "https://beta.weebform.com"],
      credentials: true,
    },
  });

  io.use(authenticateSocket);
  console.log("Socket.IO server initialized. CORS origins configured.");

  const voiceRoomUsers = {};

  io.on("connection", (socket) => {
    console.log(`[Socket] User connected: ${socket.user.id} (Socket ID: ${socket.id})`);

    const broadcastTypingStatus = (chatGroupId, userId, isTyping) => {
      socket.broadcast.to(chatGroupId).emit('userTyping', { chatGroupId, userId, isTyping });
    };

    const clearTypingStatus = (chatGroupId, userId) => {
      const groupTyping = typingUsers.get(chatGroupId);
      if (groupTyping && groupTyping.has(userId)) {
        clearTimeout(groupTyping.get(userId));
        groupTyping.delete(userId);
        broadcastTypingStatus(chatGroupId, userId, false);
        if (groupTyping.size === 0) typingUsers.delete(chatGroupId);
      }
    };

    socket.on("joinGroup", async ({ chatGroupId }) => {
      if (!chatGroupId) return socket.emit("error", { message: "Group ID is required." });
      socket.join(chatGroupId);
      console.log(`[Socket] User ${socket.user.id} joined Socket.IO room ${chatGroupId}`);

      try {
        await redisClient.sadd(`group:${chatGroupId}:online`, socket.user.id);
        const onlineUserIds = await redisClient.smembers(`group:${chatGroupId}:online`);
        console.log(`[Redis] User ${socket.user.id} joined/confirmed in group:${chatGroupId}:online. Current online user IDs: ${onlineUserIds.join(', ')}`);

        const onlineUsersDetailsPromises = onlineUserIds.map(userId => getUserInfo(userId).catch(err => {
            console.error(`[Error] Failed to get user info for ${userId} in joinGroup:`, err);
            return null;
        }));
        
        const validOnlineUsers = (await Promise.all(onlineUsersDetailsPromises)).filter(user => user !== null);
        console.log(`[Socket] Fetched details for ${validOnlineUsers.length} online users for group ${chatGroupId}`);
        
        const currentUserDetails = validOnlineUsers.find(user => user.id === socket.user.id);

        io.to(chatGroupId).emit("userPresence", {
          chatGroupId,
          onlineUsers: validOnlineUsers,
          action: "joined",
          userId: socket.user.id,
          userDetails: currentUserDetails
        });
        console.log(`[Socket] Emitted 'userPresence' (joined) with ${validOnlineUsers.length} users for user ${socket.user.id} to group ${chatGroupId}`);

        publishEvent("user.joined.chat_group", { userId: socket.user.id, chatGroupId, timestamp: Date.now() });
      } catch (err) {
        console.error(`[Error] Failed to handle joinGroup for user ${socket.user.id}, group ${chatGroupId}:`, err);
        socket.emit("error", { message: "Failed to join group due to internal error." });
      }
    });
    
    socket.on("sendMessage", async ({ chatGroupId, message, media, replyTo, audio, threadId, spoiler, mentions }) => {
      try {
        if (!chatGroupId || (!message && (!media || !media.length) && !audio)) {
          return socket.emit("error", { message: "Message, media or audio is required." });
        }

        clearTypingStatus(chatGroupId, socket.user.id);
        const canSendMessage = await checkUserPermissions(socket.user.id, chatGroupId, 'sendMessage');
        if (!canSendMessage) return socket.emit("error", { message: "You don't have permission to send messages in this group." });

        const isSlowMode = await redisClient.get(`slowmode:${chatGroupId}:${socket.user.id}`);
        if (isSlowMode) return socket.emit("error", { message: "Slow mode is enabled. Please wait." });

        let mediaKeys = media || [];
        let audioKey = null;

        if (audio) {
          const base64Data = audio.split(",")[1];
          if (!base64Data) return socket.emit("error", { message: "Invalid audio format." });
          
          const key = `uploads/audio/${Date.now()}_audio.mp3`;
          const params = { Bucket: process.env.BUCKET_NAME, Key: key, Body: Buffer.from(base64Data, "base64"), ContentType: "audio/mpeg" };
          
          await s3.send(new PutObjectCommand(params));
          audioKey = key;
        }

        const user = await getUserInfo(socket.user.id);
        if (!user) return socket.emit("error", { message: "Error fetching user data" });

        const replyData = (replyTo && replyTo.messageId) ? await getMessageById(replyTo.messageId).catch(() => null) : null;
        const mentionedUsers = parseMentions(message);

        const newMessageData = {
          userId: socket.user.id,
          chatGroupId,
          text: message || null,
          media: mediaKeys.length ? mediaKeys.join(",") : null,
          createdAt: moment().format("YYYY-MM-DD HH:mm:ss"),
          replyToMessageId: replyTo?.messageId || null,
          audio: audioKey,
          threadId: threadId || null,
          spoiler: spoiler || false,
          mentions: mentionedUsers.length ? JSON.stringify(mentionedUsers) : null
        };

        const savedMessage = await saveMessage(newMessageData);
        if (threadId) await addMessageToThread(threadId, savedMessage.id);

        const newMessage = {
          id: savedMessage.id,
          senderId: socket.user.id,
          groupId: chatGroupId,
          message,
          media: mediaKeys.map(key => processImageUrl(key)),
          createdAt: newMessageData.createdAt,
          full_name: user.full_name,
          profilePic: user.profilePic,
          replyTo: replyData,
          audio: processImageUrl(audioKey),
          threadId: threadId || null,
          spoiler: spoiler || false,
          mentions: mentionedUsers
        };

        const slowModeEnabled = await redisClient.get(`slowmode:${chatGroupId}`);
        if (slowModeEnabled) {
          await toggleUserSlowMode(socket.user.id, chatGroupId, parseInt(slowModeEnabled, 10));
        }
        
        await incrementUserActivity(socket.user.id, chatGroupId, 'message');
        io.to(chatGroupId).emit("newMessage", newMessage);
        
        if (mentionedUsers.length > 0) {
          publishEvent("user.mentioned", { mentionedUserIds: mentionedUsers.map(m => m.userId), messageId: savedMessage.id, messageText: message, senderId: socket.user.id, senderName: user.full_name, chatGroupId });
        }

        publishEvent("message.created", { messageId: savedMessage.id, userId: socket.user.id, chatGroupId, timestamp: Date.now() });

      } catch (err) {
        console.error(`[Error] sendMessage failed for user ${socket.user.id}:`, err);
        socket.emit("error", { message: "Internal server error while sending message.", error: err.message });
      }
    });
    
    const TYPING_TIMEOUT_MS = 3000;
    socket.on('startTyping', async ({ chatGroupId }) => {
      const userId = socket.user.id;
      const canSendMessage = await checkUserPermissions(userId, chatGroupId, 'sendMessage');
      if (!canSendMessage) return;
      if (!typingUsers.has(chatGroupId)) typingUsers.set(chatGroupId, new Map());
      const groupTyping = typingUsers.get(chatGroupId);
      if (groupTyping.has(userId)) clearTimeout(groupTyping.get(userId));
      else broadcastTypingStatus(chatGroupId, userId, true);
      const timeoutId = setTimeout(() => clearTypingStatus(chatGroupId, userId), TYPING_TIMEOUT_MS);
      groupTyping.set(userId, timeoutId);
    });

    socket.on('stopTyping', ({ chatGroupId }) => clearTypingStatus(chatGroupId, socket.user.id));

    socket.on("addReaction", async ({ messageId, reactionType, customEmote }) => {
      try {
        if (!messageId || (!reactionType && !customEmote)) return socket.emit("error", { message: "Message ID and reaction are required." });
        if (reactionType && !Object.values(REACTION_TYPES).includes(reactionType)) return socket.emit("error", { message: "Invalid reaction type." });
        
        const message = await getMessageById(messageId);
        if (!message) return socket.emit("error", { message: "Message not found." });
        
        const chatGroupId = message.groupId;
        const reaction = await saveReaction({ userId: socket.user.id, messageId, reactionType, customEmote, createdAt: moment().format("YYYY-MM-DD HH:mm:ss") });
        const user = await getUserInfo(socket.user.id);

        io.to(chatGroupId).emit("newReaction", {
          id: reaction.id, messageId, userId: socket.user.id,
          userName: user.full_name, userProfilePic: user.profilePic,
          reactionType, customEmote, createdAt: reaction.createdAt
        });

        await incrementUserActivity(socket.user.id, chatGroupId, 'reaction');
        publishEvent("reaction.added", { reactionId: reaction.id, messageId, userId: socket.user.id, chatGroupId, timestamp: Date.now() });
      } catch (err) {
        console.error(`[Error] addReaction failed for user ${socket.user.id}:`, err);
        socket.emit("error", { message: "Internal server error", error: err.message });
      }
    });

    socket.on("createThread", async ({ parentMessageId, initialMessage, chatGroupId }) => {
        console.log(`[Socket] Received createThread from ${socket.user.id} for parent message ${parentMessageId} in chat group ${chatGroupId}.`);
        try {
            if (!parentMessageId || !chatGroupId) {
                return socket.emit("error", { message: "Parent message ID and group ID are required." });
            }

            const parentMessage = await getMessageById(parentMessageId);
            if (!parentMessage) {
                return socket.emit("error", { message: "Parent message not found." });
            }
            if (parentMessage.groupId !== chatGroupId) {
                return socket.emit("error", { message: "Parent message does not belong to this chat group." });
            }

            const thread = await createThreadService({
                parentMessageId,
                creatorId: socket.user.id,
                chatGroupId: chatGroupId,
                createdAt: moment().format("YYYY-MM-DD HH:mm:ss")
            });
            console.log(`[DB] Thread created with ID: ${thread.id} for parent message ${parentMessageId}.`);

            let firstThreadMessage = null;
            if (initialMessage) {
                const messageData = {
                    userId: socket.user.id,
                    chatGroupId: chatGroupId,
                    text: initialMessage,
                    createdAt: moment().format("YYYY-MM-DD HH:mm:ss"),
                    threadId: thread.id
                };
                firstThreadMessage = await saveMessage(messageData);
                await addMessageToThread(thread.id, firstThreadMessage.id);
                console.log(`[DB] Initial message ${firstThreadMessage.id} added to thread ${thread.id}.`);
            }

            const user = await getUserInfo(socket.user.id);

            const threadData = {
                id: thread.id,
                parentMessageId,
                creatorId: socket.user.id,
                creatorName: user.full_name,
                creatorProfilePic: user.profilePic,
                chatGroupId: chatGroupId,
                createdAt: thread.createdAt,
                initialMessage: firstThreadMessage ? {
                    id: firstThreadMessage.id,
                    text: firstThreadMessage.text,
                    senderId: firstThreadMessage.userId,
                    senderName: user.full_name,
                    createdAt: firstThreadMessage.createdAt,
                    groupId: firstThreadMessage.chatGroupId
                } : null
            };

            io.to(chatGroupId).emit("threadCreated", threadData);
            console.log(`[Socket] Broadcasted 'threadCreated' for thread ${thread.id} to chat group ${chatGroupId}.`);

            await incrementUserActivity(socket.user.id, chatGroupId, 'thread');
            publishEvent("thread.created", {
                threadId: thread.id,
                parentMessageId,
                creatorId: socket.user.id,
                chatGroupId: chatGroupId,
                hasInitialMessage: !!initialMessage,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error(`[Error] Error creating thread for user ${socket.user.id} (parentMessageId: ${parentMessageId}):`, err);
            socket.emit("error", { message: "Internal server error while creating thread.", error: err.message });
        }
    });

    socket.on("getThreadMessages", async ({ threadId }) => {
        console.log(`[Socket] Received getThreadMessages from ${socket.user.id} for thread ${threadId}.`);
        try {
            if (!threadId) {
                return socket.emit("error", { message: "Thread ID is required." });
            }
            
            const [thread] = await db.promise().query("SELECT chatGroupId FROM message_threads WHERE id = ?", [threadId]);
            if (thread.length === 0) {
                return socket.emit("error", { message: "Thread not found." });
            }
            const chatGroupId = thread[0].chatGroupId;
            
            const isMember = await checkUserPermissions(socket.user.id, chatGroupId, 'viewMessages');
            if (!isMember) {
                return socket.emit("error", { message: "You don't have permission to view this thread." });
            }

            const messages = await getThreadMessages(threadId);
            socket.emit("threadMessages", { threadId, messages });
            console.log(`[Socket] Emitted ${messages.length} thread messages for thread ${threadId} to user ${socket.user.id}.`);
        } catch (err) {
            console.error(`[Error] Error fetching thread messages for user ${socket.user.id} (threadId: ${threadId}):`, err);
            socket.emit("error", { message: "Internal server error while fetching thread messages.", error: err.message });
        }
    });

    socket.on("adminAction", async ({ chatGroupId, action, targetUserId, duration, reason }) => {
        console.log(`[Socket] Received adminAction '${action}' from admin ${socket.user.id} on user ${targetUserId} in chat group ${chatGroupId}.`);
        try {
            if (!chatGroupId || !action || !targetUserId) {
                return socket.emit("error", { message: "Group ID, action, and target user ID are required." });
            }

            const isAdmin = await getGroupAdminInfo(socket.user.id, chatGroupId);
            if (!isAdmin) {
                return socket.emit("error", { message: "You don't have admin privileges in this community." });
            }

            const adminId = socket.user.id;
            switch (action) {
                case ADMIN_ACTIONS.SLOW_MODE:
                    await toggleUserSlowMode(targetUserId, chatGroupId, duration, adminId);
                    break;
                case ADMIN_ACTIONS.MUTE:
                    await toggleUserMute(targetUserId, chatGroupId, duration, adminId);
                    break;
                case ADMIN_ACTIONS.EXILE:
                    await toggleUserExile(targetUserId, chatGroupId, duration, adminId);
                    break;
                case ADMIN_ACTIONS.REMOVE:
                    await removeUserFromGroup(targetUserId, chatGroupId, adminId);
                    break;
                default:
                    return socket.emit("error", { message: "Invalid admin action." });
            }

            io.to(chatGroupId).emit("adminActionPerformed", {
                chatGroupId,
                action,
                targetUserId,
                adminId: socket.user.id,
                duration,
                reason,
                timestamp: Date.now()
            });
            console.log(`[Socket] Broadcasted 'adminActionPerformed' for action '${action}' to chat group ${chatGroupId}.`);

            publishEvent("admin.action", { chatGroupId, action, targetUserId, adminId, duration, reason, timestamp: Date.now() });
        } catch (err) {
            console.error(`[Error] Error performing admin action '${action}' by ${socket.user.id}:`, err);
            socket.emit("error", { message: "Internal server error while performing admin action.", error: err.message });
        }
    });

    socket.on("startCountdown", async ({ chatGroupId, duration, title }) => {
        console.log(`[Socket] Received startCountdown from ${socket.user.id} for group ${chatGroupId}.`);
        try {
            if (!chatGroupId || !duration) {
                return socket.emit("error", { message: "Group ID and duration are required." });
            }

            const countdownId = `countdown:${chatGroupId}:${Date.now()}`;
            const endTime = Date.now() + (duration * 1000);

            io.to(chatGroupId).emit("countdownStarted", {
                countdownId,
                title: title || "Countdown",
                startedBy: socket.user.id,
                duration,
                endTime
            });
            console.log(`[Socket] Broadcasted 'countdownStarted' (ID: ${countdownId}) to group ${chatGroupId}.`);

            setTimeout(() => {
                io.to(chatGroupId).emit("countdownEnded", { countdownId, title: title || "Countdown" });
                console.log(`[Socket] Broadcasted 'countdownEnded' (ID: ${countdownId}) to group ${chatGroupId}.`);
            }, duration * 1000);
        } catch (err) {
            console.error(`[Error] Error starting countdown for user ${socket.user.id}:`, err);
            socket.emit("error", { message: "Internal server error while starting countdown.", error: err.message });
        }
    });

    socket.on("sendQuoteMacro", async ({ chatGroupId, macroId, customText }) => {
        console.log(`[Socket] Received sendQuoteMacro from ${socket.user.id} to group ${chatGroupId}.`);
        try {
            if (!chatGroupId || !macroId) {
                return socket.emit("error", { message: "Group ID and macro ID are required." });
            }

            const user = await getUserInfo(socket.user.id);
            if (!user) {
                return socket.emit("error", { message: "Error fetching user data" });
            }

            io.to(chatGroupId).emit("quoteMacro", {
                macroId,
                userId: socket.user.id,
                userName: user.full_name,
                userProfilePic: user.profilePic,
                customText,
                timestamp: Date.now()
            });
            console.log(`[Socket] Broadcasted 'quoteMacro' (ID: ${macroId}) to group ${chatGroupId}.`);

            await incrementUserActivity(socket.user.id, chatGroupId, 'quoteMacro');
        } catch (err) {
            console.error(`[Error] Error sending quote macro for user ${socket.user.id}:`, err);
            socket.emit("error", { message: "Internal server error while sending quote macro.", error: err.message });
        }
    });
    
    socket.on("disconnect", async (reason) => {
        console.log(`[Socket] User disconnected: ${socket.user.id} (Socket ID: ${socket.id}). Reason: ${reason}`);
        try {
            typingUsers.forEach((group, groupId) => { if (group.has(socket.user.id)) clearTypingStatus(groupId, socket.user.id); });

            const userGroupsKeys = await redisClient.keys(`group:*:online`);
            for (const groupKey of userGroupsKeys) {
                const isMember = await redisClient.sismember(groupKey, socket.user.id);
                if (isMember) {
                    await redisClient.srem(groupKey, socket.user.id);
                    const chatGroupId = groupKey.split(':')[1];
                    console.log(`[Redis] User ${socket.user.id} removed from group:${chatGroupId}:online.`);

                    const remainingOnlineUserIds = await redisClient.smembers(groupKey);
                    
                    const onlineUsersDetailsPromises = remainingOnlineUserIds.map(userId => getUserInfo(userId).catch(() => null));
                    const validOnlineUsers = (await Promise.all(onlineUsersDetailsPromises)).filter(user => user !== null);

                    console.log(`[Socket] Fetched details for ${validOnlineUsers.length} remaining users for group ${chatGroupId}`);

                    io.to(chatGroupId).emit("userPresence", {
                        chatGroupId: chatGroupId,
                        onlineUsers: validOnlineUsers,
                        action: "left",
                        userId: socket.user.id 
                    });
                    console.log(`[Socket] Broadcasted 'userPresence' (left) for user ${socket.user.id} to group ${chatGroupId}.`);
                }
            }
            
            for (const roomId in voiceRoomUsers) {
                if (voiceRoomUsers[roomId][socket.user.id]) {
                    delete voiceRoomUsers[roomId][socket.user.id];
                    io.to(`voice:${roomId}`).emit("voiceRoomUpdate", {
                        roomId,
                        action: "userLeft",
                        userId: socket.user.id
                    });
                    if (Object.keys(voiceRoomUsers[roomId]).length === 0) {
                        delete voiceRoomUsers[roomId];
                    }
                }
            }

            publishEvent("user.disconnected", {
                userId: socket.user.id,
                timestamp: Date.now()
            });
            console.log(`[EventBus] Published 'user.disconnected' event for user ID: ${socket.user.id}.`);

        } catch (err) {
            console.error(`[Error] Error handling disconnect for user ${socket.user.id}:`, err);
        }
    });
  });

  return io;
};