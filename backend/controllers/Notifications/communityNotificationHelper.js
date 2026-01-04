import { db } from "../../config/connectDB.js";
import { redisClient } from "../../config/redisConfig.js";
import { createNotification } from "./notificationsController.js";

// HANDLE GROUP CHAT NOTIFICATIONS
export const handleGroupChatNotifications = async (senderId, chatGroupId, messageId, messageText, senderUsername, mentionedUserIds = []) => {
    try {
        // GEI COMMUNITY & GROUP INFO
        const [info] = await db.promise().query(
            `SELECT g.name AS groupName, c.id AS communityId, c.title AS communityTitle 
             FROM chat_groups g 
             JOIN communities c ON g.communityId = c.id 
             WHERE g.id = ?`, 
            [chatGroupId]
        );

        if (info.length === 0) return;
        const { groupName, communityId, communityTitle } = info[0];

        // HANDLE MENTIONS FIRST
        if (mentionedUserIds.length > 0) {
            const mentionPromises = mentionedUserIds.map(targetId => 
                createNotification(
                    'CHAT_MENTION',
                    senderId,
                    targetId,
                    { communityId, groupId: chatGroupId, messageId },
                    { groupName, communityTitle, senderUsername, messagePreview: messageText.substring(0, 40) }
                )
            );
            await Promise.all(mentionPromises);
        }

        // HANDLE GENERAL NOTIFICATIONS
        const [members] = await db.promise().query(
            "SELECT userId FROM community_members WHERE communityId = ? AND userId != ?",
            [communityId, senderId]
        );

        const activeInGroup = await redisClient.smembers(`group:${chatGroupId}:online`);

        const msgPromises = members
            .filter(m => !activeInGroup.includes(String(m.userId)) && !mentionedUserIds.includes(m.userId))
            .map(m => createNotification(
                'COMMUNITY_MESSAGE',
                senderId,
                m.userId,
                { communityId, groupId: chatGroupId, messageId },
                { groupName, communityTitle, senderUsername, messagePreview: messageText.substring(0, 40) }
            ));

        await Promise.all(msgPromises);

    } catch (error) {
        console.error("[Helper Error] Group Notification failed:", error);
    }
};