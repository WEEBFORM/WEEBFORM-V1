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

const typingUsers = new Map();

export const initializeMessageSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3001',
        'http://localhost:3002',
        "https://beta.weebform.com"
      ],
      credentials: true,
    },
  });

  io.use(authenticateSocket);
  console.log("Socket.IO server initialized. CORS origins configured.");

  //  NOT IMPLEMENTED, YET. POTENTIAL UPDATE
  const voiceRoomUsers = {};

  io.on("connection", (socket) => {
    console.log(`[Socket] User connected: ${socket.user.id} (Socket ID: ${socket.id})`);

    const broadcastTypingStatus = (chatGroupId, userId, isTyping) => {
      socket.broadcast.to(chatGroupId).emit('userTyping', { chatGroupId, userId, isTyping });
      console.log(`[Socket] Broadcasting userTyping: ${userId} in ${chatGroupId} isTyping: ${isTyping}`);
    };

    const clearTypingStatus = (chatGroupId, userId) => {
      const groupTyping = typingUsers.get(chatGroupId);
      if (groupTyping && groupTyping.has(userId)) {
        clearTimeout(groupTyping.get(userId));
        groupTyping.delete(userId);
        broadcastTypingStatus(chatGroupId, userId, false);
        if (groupTyping.size === 0) {
          typingUsers.delete(chatGroupId);
        }
      }
    };

    socket.on("joinGroup", async ({ chatGroupId }) => {
      console.log(`[Socket] Received joinGroup event from ${socket.user.id} for chat group ${chatGroupId}`);
      if (!chatGroupId) {
        console.warn(`[Socket] joinGroup: Group ID (chatGroupId) is required for user ${socket.user.id}.`);
        return socket.emit("error", { message: "Group ID is required." });
      }

      socket.join(chatGroupId);
      console.log(`[Socket] User ${socket.user.id} joined Socket.IO room ${chatGroupId}`);

      try {
        await redisClient.sadd(`group:${chatGroupId}:online`, socket.user.id);
        const onlineUserIds = await redisClient.smembers(`group:${chatGroupId}:online`);
        console.log(`[Redis] User ${socket.user.id} added to group:${chatGroupId}:online. Current online user IDs: ${onlineUserIds.join(', ')}`);

        // FETCH ONLINE DETAILS FIR EACH USER ID
        const onlineUsersDetailsPromises = onlineUserIds.map(async (userId) => {
          try {
            const userInfo = await getUserInfo(userId);
            return userInfo;
          } catch (err) {
            console.error(`[Error] Failed to get user info for ${userId} in joinGroup:`, err);
            return null;
          }
        });
        const resolvedOnlineUsersDetails = await Promise.all(onlineUsersDetailsPromises);
        
        // FILTER OUT NULL VALUES
        const validOnlineUsers = resolvedOnlineUsersDetails.filter(user => user !== null);

        console.log(`[Socket] Fetched details for ${validOnlineUsers.length} online users for group ${chatGroupId}`);
        
        const currentUserDetails = await getUserInfo(socket.user.id);


        io.to(chatGroupId).emit("userPresence", {
          chatGroupId,
          onlineUsers: validOnlineUsers,
          action: "joined",
          userId: socket.user.id,
          userDetails: currentUserDetails
        });
        console.log(`[Socket] Emitted 'userPresence' (joined) with ${validOnlineUsers.length} user details for user ${socket.user.id} to chat group ${chatGroupId}`);

        publishEvent("user.joined.chat_group", {
          userId: socket.user.id,
          chatGroupId,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error(`[Error] Failed to handle joinGroup for user ${socket.user.id}, chat group ${chatGroupId}:`, err);
        socket.emit("error", { message: "Failed to join group due to internal error." });
      }
    });

    // -------- MESSAGE HANDLING --------
    socket.on("sendMessage", async ({
      chatGroupId,
      message,
      media,
      replyTo,
      audio,
      threadId,
      spoiler,
      mentions
    }) => {
      console.log(`[Socket] Received sendMessage from ${socket.user.id} to chat group ${chatGroupId}.`);
      console.log(`[Socket] Message data: { message: "${message}", media: ${media?.length}, audio: ${!!audio}, replyTo: ${replyTo?.messageId}, threadId: ${threadId}, spoiler: ${spoiler}, mentions: ${mentions?.length} }`);

      try {
        if (!chatGroupId || (!message && (!media || !media.length) && !audio)) {
          console.warn(`[Socket] sendMessage: Missing required fields for user ${socket.user.id} in chat group ${chatGroupId}.`);
          return socket.emit("error", { message: "Message, media or audio is required." });
        }

        // CLEAR TYPING STATUS AFTER MESSAGE SEND
        clearTypingStatus(chatGroupId, socket.user.id);

        const canSendMessage = await checkUserPermissions(socket.user.id, chatGroupId, 'sendMessage');
        if (!canSendMessage) {
          console.warn(`[Moderation] User ${socket.user.id} attempted to send message without permission in chat group ${chatGroupId}.`);
          return socket.emit("error", { message: "You don't have permission to send messages in this group (e.g., muted, exiled, or not a member)." });
        }

        const isSlowMode = await redisClient.get(`slowmode:${chatGroupId}:${socket.user.id}`);
        if (isSlowMode) {
          console.warn(`[Moderation] User ${socket.user.id} is in slow mode for chat group ${chatGroupId}.`);
          return socket.emit("error", { message: "Slow mode is enabled. Please wait before sending another message." });
        }

        let mediaUrls = [];
        if (media && media.length > 0) {
          mediaUrls = media;
          console.log(`[S3] Media URLs provided: ${mediaUrls.length}`);
        }

        let audioUrl = null;
        if (audio) {
          console.log(`[S3] Audio data received, processing for upload.`);
          const base64Data = audio.split(",")[1];
          if (!base64Data) {
            console.warn(`[S3] Invalid audio base64 format for user ${socket.user.id}: ${audio.substring(0, 50)}...`);
            return socket.emit("error", { message: "Invalid audio format provided." });
          }
          const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: `uploads/audio/${Date.now()}_audio.mp4`,
            Body: Buffer.from(base64Data, 'base64'),
            ContentType: "audio/mp4",
          };
          console.log(`[S3] Attempting to upload audio to S3. Key: ${params.Key}`);
          const command = new PutObjectCommand(params);
          await s3.send(command);
          audioUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
          console.log(`[S3] Audio uploaded successfully: ${audioUrl}`);
        }

        const user = await getUserInfo(socket.user.id);
        if (!user) {
          console.error(`[Error] User data not found for ID: ${socket.user.id}`);
          return socket.emit("error", { message: "Error fetching user data" });
        } 

        let replyData = null;
        if (replyTo && replyTo.messageId) { 
          try {
            replyData = await getMessageById(replyTo.messageId);
            console.log(`[DB] Fetched replyTo message ${replyTo.messageId}.`);
          } catch (replyErr) {
            console.warn(`[DB] Could not find replyTo message ${replyTo.messageId}:`, replyErr.message);
          }
        }

        const mentionedUsers = parseMentions(message);
        console.log(`[Message] Parsed mentions: ${mentionedUsers.join(', ')}`);

        const newMessageData = {
          userId: socket.user.id,
          chatGroupId,
          text: message || null,
          media: mediaUrls.length ? mediaUrls.join(",") : null,
          createdAt: moment().format("YYYY-MM-DD HH:mm:ss"),
          replyToMessageId: replyTo?.messageId || null,
          audio: audioUrl,
          threadId: threadId || null,
          spoiler: spoiler || false,
          mentions: mentionedUsers.length ? JSON.stringify(mentionedUsers) : null
        };

        const savedMessage = await saveMessage(newMessageData);
        console.log(`[DB] Message saved with ID: ${savedMessage.id}`);

        if (threadId) {
          await addMessageToThread(threadId, savedMessage.id);
          console.log(`[DB] Message ${savedMessage.id} added to thread ${threadId}.`);
        }

        const newMessage = {
          id: savedMessage.id,
          senderId: socket.user.id,
          groupId: chatGroupId,
          message,
          media: mediaUrls,
          createdAt: newMessageData.createdAt,
          full_name: user.full_name,
          profilePic: user.profilePic,
          replyTo: replyData,
          audio: audioUrl,
          threadId: threadId || null,
          spoiler: spoiler || false,
          mentions: mentionedUsers
        };

        const slowModeEnabled = await redisClient.get(`slowmode:${chatGroupId}`);
        if (slowModeEnabled) {
          await toggleUserSlowMode(socket.user.id, chatGroupId, parseInt(slowModeEnabled, 10));
          console.log(`[Moderation] Slow mode applied for user ${socket.user.id} in chat group ${chatGroupId} for ${slowModeEnabled}s due to group setting.`);
        }

        await incrementUserActivity(socket.user.id, chatGroupId, 'message');
        console.log(`[Gamification] User ${socket.user.id} activity incremented for message.`);

        io.to(chatGroupId).emit("newMessage", newMessage);
        console.log(`[Socket] Broadcasted newMessage (ID: ${newMessage.id}) to chat group ${chatGroupId} (excluding sender).`);

        if (mentionedUsers.length > 0) {
          publishEvent("user.mentioned", {
            mentionedUserIds: mentionedUsers,
            messageId: savedMessage.id,
            messageText: message,
            senderId: socket.user.id,
            senderName: user.full_name,
            chatGroupId
          });
          console.log(`[EventBus] Published 'user.mentioned' event for mentioned users: ${mentionedUsers.join(', ')}.`);
        }

        publishEvent("message.created", {
          messageId: savedMessage.id,
          userId: socket.user.id,
          chatGroupId,
          hasMedia: mediaUrls.length > 0,
          hasAudio: !!audioUrl,
          isReply: !!replyTo,
          isThreaded: !!threadId,
          hasSpoiler: spoiler,
          hasMentions: mentionedUsers.length > 0,
          timestamp: Date.now()
        });
        console.log(`[EventBus] Published 'message.created' event for message ID: ${savedMessage.id}.`);
      } catch (err) {
        console.error(`[Error] Error sending message for user ${socket.user.id} in chat group ${chatGroupId}:`, err);
        socket.emit("error", { message: "Internal server error occurred while sending message. Please try again.", error: err.message });
      }
    });

    // -------- TYPING INDICATOR --------
    const TYPING_TIMEOUT_MS = 3000;
    socket.on('startTyping', async ({ chatGroupId }) => {
      const userId = socket.user.id;
      const canSendMessage = await checkUserPermissions(userId, chatGroupId, 'sendMessage');
      if (!canSendMessage) return;

      if (!typingUsers.has(chatGroupId)) {
        typingUsers.set(chatGroupId, new Map());
      }
      const groupTyping = typingUsers.get(chatGroupId);

      // CLEAR TIMEOUTS FOR GROUP
      if (groupTyping.has(userId)) {
        clearTimeout(groupTyping.get(userId));
      } else {
        broadcastTypingStatus(chatGroupId, userId, true);
      }

      const timeoutId = setTimeout(() => {
        clearTypingStatus(chatGroupId, userId);
      }, TYPING_TIMEOUT_MS);

      groupTyping.set(userId, timeoutId);
      console.log(`[Socket] User ${userId} started typing in ${chatGroupId}.`);
    });

    socket.on('stopTyping', ({ chatGroupId }) => {
      const userId = socket.user.id;
      console.log(`[Socket] User ${userId} stopped typing in ${chatGroupId}.`);
      clearTypingStatus(chatGroupId, userId);
    });

    // -------- REACTIONS --------
    socket.on("addReaction", async ({ messageId, reactionType, customEmote }) => {
      console.log(`[Socket] Received addReaction from ${socket.user.id} to message ${messageId} (Type: ${reactionType}, Emote: ${customEmote}).`);
      try {
        if (!messageId || (!reactionType && !customEmote)) {
          console.warn(`[Socket] addReaction: Missing message ID or reaction type/emote for user ${socket.user.id}.`);
          return socket.emit("error", { message: "Message ID and reaction type are required." });
        }

        if (reactionType && !Object.values(REACTION_TYPES).includes(reactionType)) {
          console.warn(`[Socket] addReaction: Invalid reaction type '${reactionType}' for user ${socket.user.id}.`);
          return socket.emit("error", { message: "Invalid reaction type." });
        }

        const message = await getMessageById(messageId);
        if (!message) {
          console.warn(`[DB] Message ${messageId} not found for reaction from user ${socket.user.id}.`);
          return socket.emit("error", { message: "Message not found." });
        }
        const chatGroupId = message.groupId;

        const reaction = await saveReaction({
          userId: socket.user.id,
          messageId,
          reactionType,
          customEmote,
          createdAt: moment().format("YYYY-MM-DD HH:mm:ss")
        });
        console.log(`[DB] Reaction saved with ID: ${reaction.id}.`);

        const user = await getUserInfo(socket.user.id);

        io.to(chatGroupId).emit("newReaction", {
          id: reaction.id,
          messageId,
          userId: socket.user.id,
          userName: user.full_name,
          userProfilePic: user.profilePic,
          reactionType,
          customEmote,
          createdAt: reaction.createdAt
        });
        console.log(`[Socket] Broadcasted newReaction for message ${messageId} to chat group ${chatGroupId}.`);

        await incrementUserActivity(socket.user.id, chatGroupId, 'reaction');
        console.log(`[Gamification] User ${socket.user.id} activity incremented for reaction.`);

        publishEvent("reaction.added", {
          reactionId: reaction.id,
          messageId,
          userId: socket.user.id,
          chatGroupId: chatGroupId,
          timestamp: Date.now()
        });
        console.log(`[EventBus] Published 'reaction.added' event for reaction ID: ${reaction.id}.`);
      } catch (err) {
        console.error(`[Error] Error adding reaction for user ${socket.user.id} to message ${messageId}:`, err);
        socket.emit("error", { message: "Internal server error", error: err.message });
      }
    });

    // -------- THREAD MANAGEMENT --------
    socket.on("createThread", async ({ parentMessageId, initialMessage, chatGroupId }) => { 
      console.log(`[Socket] Received createThread from ${socket.user.id} for parent message ${parentMessageId} in chat group ${chatGroupId}.`);
      try {
        if (parentMessage.groupId !== chatGroupId) { 
          console.warn(`[DB] Parent message ${parentMessageId} (ID: ${parentMessage.id}) belongs to different group (${parentMessage.groupId}) than provided by client (${chatGroupId}).`);
          return socket.emit("error", { message: "Parent message does not belong to this chat group." });
      }

      // Use the renamed import for the service function
      const thread = await createThreadService({ 
        parentMessageId,
        creatorId: socket.user.id,
        chatGroupId: chatGroupId, // This is the correct chatGroupId to store in message_threads table
        createdAt: moment().format("YYYY-MM-DD HH:mm:ss")
      });
      console.log(`[DB] Thread created with ID: ${thread.id} for parent message ${parentMessageId}.`);

      if (initialMessage) {
        const messageData = {
          userId: socket.user.id,
          chatGroupId: chatGroupId, // This should be the same chatGroupId
          text: initialMessage,
          createdAt: moment().format("YYYY-MM-DD HH:mm:ss"),
          threadId: thread.id
        };

        const firstThreadMessage = await saveMessage(messageData);
        await addMessageToThread(thread.id, firstThreadMessage.id);
        console.log(`[DB] Initial message ${firstThreadMessage.id} added to thread ${thread.id}.`);
      }

      const user = await getUserInfo(socket.user.id);

      // Prepare threadData for emitting to client
      // Make sure `chatGroupId` is consistently named if frontend expects it as `groupId`
      // However, for internal consistency and since `message_threads` table uses `chatGroupId`,
      // it's probably fine to emit `chatGroupId` here.
      // Frontend's ThreadView correctly receives `groupId` prop and destructures it as `chatGroupId` for its internal use.
      const threadData = {
        id: thread.id,
        parentMessageId,
        creatorId: socket.user.id,
        creatorName: user.full_name,
        creatorProfilePic: user.profilePic,
        chatGroupId: chatGroupId, // Emitting the actual chatGroupId
        createdAt: thread.createdAt,
        initialMessage: initialMessage && firstThreadMessage ? { // Use the saved firstThreadMessage if available
          id: firstThreadMessage.id, 
          text: firstThreadMessage.text,
          senderId: firstThreadMessage.userId,
          senderName: user.full_name, // Assuming sender is current user
          createdAt: firstThreadMessage.createdAt,
          groupId: firstThreadMessage.chatGroupId // Consistent with other messages
        } : (initialMessage ? { // Fallback if firstThreadMessage not directly available (e.g., if initialMessage was just text)
          id: null, // No DB ID yet for this specific display object
          text: initialMessage,
          senderId: socket.user.id,
          senderName: user.full_name,
          createdAt: moment().format("YYYY-MM-DD HH:mm:ss"),
          groupId: chatGroupId
        } : null)
      };
      

      io.to(chatGroupId).emit("threadCreated", threadData);
      console.log(`[Socket] Broadcasted 'threadCreated' for thread ${thread.id} to chat group ${chatGroupId}.`);

      await incrementUserActivity(socket.user.id, chatGroupId, 'thread');
      console.log(`[Gamification] User ${socket.user.id} activity incremented for thread creation.`);

      publishEvent("thread.created", {
        threadId: thread.id,
        parentMessageId,
        creatorId: socket.user.id,
        chatGroupId: chatGroupId,
        hasInitialMessage: !!initialMessage,
        timestamp: Date.now()
      });
      console.log(`[EventBus] Published 'thread.created' event for thread ID: ${thread.id}.`);
    } catch (err) {
      console.error(`[Error] Error creating thread for user ${socket.user.id} (parentMessageId: ${parentMessageId}):`, err);
      socket.emit("error", { message: "Internal server error", error: err.message });
    }
  });


    socket.on("getThreadMessages", async ({ threadId }) => {
      console.log(`[Socket] Received getThreadMessages from ${socket.user.id} for thread ${threadId}.`);
      try {
        if (!threadId) {
          console.warn(`[Socket] getThreadMessages: Thread ID is required for user ${socket.user.id}.`);
          return socket.emit("error", { message: "Thread ID is required." });
        }
        const thread = await db.promise().query("SELECT chatGroupId FROM message_threads WHERE id = ?", [threadId]);
        if (thread.length === 0) {
            console.warn(`[DB] Thread ${threadId} not found.`);
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
        socket.emit("error", { message: "Internal server error", error: err.message });
      }
    });

    // -------- ADMIN ACTIONS --------
    socket.on("adminAction", async ({ chatGroupId, action, targetUserId, duration, reason }) => {
      console.log(`[Socket] Received adminAction '${action}' from admin ${socket.user.id} on user ${targetUserId} in chat group ${chatGroupId}.`);
      try {
        if (!chatGroupId || !action || !targetUserId) {
          console.warn(`[Socket] adminAction: Missing chat group ID, action, or target user ID for admin ${socket.user.id}.`);
          return socket.emit("error", { message: "Group ID, action, and target user ID are required." });
        }

        const isAdmin = await getGroupAdminInfo(socket.user.id, chatGroupId);
        if (!isAdmin) {
          console.warn(`[Moderation] User ${socket.user.id} attempted admin action without privileges in chat group ${chatGroupId}.`);
          return socket.emit("error", { message: "You don't have admin privileges in this community." });
        }

        let actionResult;
        const adminId = socket.user.id;

        switch (action) {
          case ADMIN_ACTIONS.SLOW_MODE:
            actionResult = await toggleUserSlowMode(targetUserId, chatGroupId, duration, adminId);
            console.log(`[Moderation] Admin ${adminId} applied slow mode to ${targetUserId} in chat group ${chatGroupId}.`);
            break;
          case ADMIN_ACTIONS.MUTE:
            actionResult = await toggleUserMute(targetUserId, chatGroupId, duration, adminId);
            console.log(`[Moderation] Admin ${adminId} muted ${targetUserId} in chat group ${chatGroupId}.`);
            break;
          case ADMIN_ACTIONS.EXILE:
            actionResult = await toggleUserExile(targetUserId, chatGroupId, duration, adminId);
            console.log(`[Moderation] Admin ${adminId} exiled ${targetUserId} in chat group ${chatGroupId}.`);
            break;
          case ADMIN_ACTIONS.REMOVE:
            actionResult = await removeUserFromGroup(targetUserId, chatGroupId, adminId);
            console.log(`[Moderation] Admin ${adminId} removed ${targetUserId} from chat group ${chatGroupId}.`);
            break;
          default:
            console.warn(`[Socket] adminAction: Invalid admin action '${action}' requested by ${socket.user.id}.`);
            return socket.emit("error", { message: "Invalid admin action." });
        }
        console.log(`[Moderation] Admin action '${action}' result:`, actionResult);

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

        publishEvent("admin.action", {
          chatGroupId,
          action,
          targetUserId,
          adminId: socket.user.id,
          duration,
          reason,
          timestamp: Date.now()
        });
        console.log(`[EventBus] Published 'admin.action' event for action '${action}'.`);
      } catch (err) {
        console.error(`[Error] Error performing admin action '${action}' by ${socket.user.id} on ${targetUserId} in chat group ${chatGroupId}:`, err);
        socket.emit("error", { message: "Internal server error", error: err.message });
      }
    });

    // -------- COUNTDOWN (Feature for chat groups) --------
    socket.on("startCountdown", async ({ chatGroupId, duration, title }) => {
      console.log(`[Socket] Received startCountdown from ${socket.user.id} for chat group ${chatGroupId} (Duration: ${duration}, Title: ${title}).`);
      try {
        if (!chatGroupId || !duration) {
          console.warn(`[Socket] startCountdown: Group ID (chatGroupId) or duration is missing for user ${socket.user.id}.`);
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
        console.log(`[Socket] Broadcasted 'countdownStarted' (ID: ${countdownId}) to chat group ${chatGroupId}.`);

        setTimeout(() => {
          io.to(chatGroupId).emit("countdownEnded", {
            countdownId,
            title: title || "Countdown"
          });
          console.log(`[Socket] Broadcasted 'countdownEnded' (ID: ${countdownId}) to chat group ${chatGroupId}.`);
        }, duration * 1000);
      } catch (err) {
        console.error(`[Error] Error starting countdown for user ${socket.user.id} in chat group ${chatGroupId}:`, err);
        socket.emit("error", { message: "Internal server error", error: err.message });
      }
    });

    // -------- QUOTE MACROS (Feature for chat groups) --------
    socket.on("sendQuoteMacro", async ({ chatGroupId, macroId, customText }) => {
      console.log(`[Socket] Received sendQuoteMacro from ${socket.user.id} to chat group ${chatGroupId} (Macro ID: ${macroId}).`);
      try {
        if (!chatGroupId || !macroId) {
          console.warn(`[Socket] sendQuoteMacro: Group ID (chatGroupId) or macro ID is missing for user ${socket.user.id}.`);
          return socket.emit("error", { message: "Group ID and macro ID are required." });
        }

        const user = await getUserInfo(socket.user.id);
        if (!user) {
          console.error(`[Error] User data not found for ID: ${socket.user.id} when sending quote macro.`);
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
        console.log(`[Socket] Broadcasted 'quoteMacro' (Macro ID: ${macroId}) to chat group ${chatGroupId}.`);

        await incrementUserActivity(socket.user.id, chatGroupId, 'quoteMacro');
        console.log(`[Gamification] User ${socket.user.id} activity incremented for quote macro.`);
      } catch (err) {
        console.error(`[Error] Error sending quote macro for user ${socket.user.id} in chat group ${chatGroupId}:`, err);
        socket.emit("error", { message: "Internal server error", error: err.message });
      }
    });

    // -------- DISCONNECT HANDLER --------
    socket.on("disconnect", async (reason) => {
      console.log(`[Socket] User disconnected: ${socket.user.id} (Socket ID: ${socket.id}). Reason: ${reason}`);

      try {
        typingUsers.forEach((groupTypingMap, groupTypingId) => {
            if (groupTypingMap.has(socket.user.id)) {
                clearTypingStatus(groupTypingId, socket.user.id);
            }
        });

        const userGroupsKeys = await redisClient.keys(`group:*:online`);
        console.log(`[Redis] Checking ${userGroupsKeys.length} group keys for user ${socket.user.id} on disconnect.`);
        
        for (const groupKey of userGroupsKeys) {
          const isMember = await redisClient.sismember(groupKey, socket.user.id);
          if (isMember) {
            await redisClient.srem(groupKey, socket.user.id);
            const chatGroupId = groupKey.split(':')[1];
            console.log(`[Redis] User ${socket.user.id} removed from group:${chatGroupId}:online.`);

            const remainingOnlineUserIds = await redisClient.smembers(groupKey);
            
            // Fetch full user info for each remaining online user ID
            const onlineUsersDetailsPromises = remainingOnlineUserIds.map(async (userId) => {
                try {
                    const userInfo = await getUserInfo(userId);
                    return userInfo;
                } catch (err) {
                    console.error(`[Error] Failed to get user info for ${userId} in disconnect handler for group ${chatGroupId}:`, err);
                    return null;
                }
            });
            const resolvedOnlineUsersDetails = await Promise.all(onlineUsersDetailsPromises);
            const validOnlineUsers = resolvedOnlineUsersDetails.filter(user => user !== null);

            console.log(`[Socket] Fetched details for ${validOnlineUsers.length} remaining online users for group ${chatGroupId}`);

            io.to(chatGroupId).emit("userPresence", {
              chatGroupId: chatGroupId,
              onlineUsers: validOnlineUsers,
              action: "left",
              userId: socket.user.id 
            });
            console.log(`[Socket] Broadcasted 'userPresence' (left) with ${validOnlineUsers.length} user details for user ${socket.user.id} to chat group ${chatGroupId}.`);
          }
        }

        // REMOVE USER FROM VOICE ROOMS (Commented out as not implemented yet)
        for (const roomId in voiceRoomUsers) {
          if (voiceRoomUsers[roomId][socket.user.id]) {
            delete voiceRoomUsers[roomId][socket.user.id];
            console.log(`[Voice] User ${socket.user.id} removed from voice room ${roomId}.`);

            // BROADCAST USER LEFT VOICE ROOM
            io.to(`voice:${roomId}`).emit("voiceRoomUpdate", {
              roomId,
              action: "userLeft",
              userId: socket.user.id
            });
            console.log(`[Socket] Broadcasted voiceRoomUpdate (userLeft) for ${socket.user.id} in voice room ${roomId}.`);

            if (Object.keys(voiceRoomUsers[roomId]).length === 0) {
              delete voiceRoomUsers[roomId];
              console.log(`[Voice] Voice room ${roomId} is now empty and removed.`);
            }
          }
        }

        // PUBLISH DISCONNECT EVENT
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