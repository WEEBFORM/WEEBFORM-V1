import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import { sendNotificationEmail } from "../../middlewares/sendMail.js";
import { processImageUrl } from '../../middlewares/cloudfrontConfig.js';
import { sendPushNotification } from "./pushNotificationService.js";

const constructNotificationMessage = (notification) => {
    const { type, senderUsername, details, communityTitle, storeLabel } = notification;
    const actor = details.senderUsername || details.postAuthorUsername || senderUsername;

    switch(type) {
        case 'LIKE_POST':
            return `${actor} liked your post.`;
        case 'SHARE_POST':
            return `${actor} shared your post.`;
        case 'FOLLOW':
            return `${actor} started following you.`;
        case 'COMMENT_ON_POST':
            return `${actor} commented on your post.`;
        case 'REPLY_TO_COMMENT':
        case 'REPLY_TO_REPLY':
            return `${actor} replied to your comment.`;
        case 'NEW_POST_FROM_FOLLOWING':
            return `${actor} created a new post.`;
        case 'COMMUNITY_JOIN':
            return `${actor} joined your community, ${communityTitle}.`;
        case 'COMMUNITY_INVITE':
            return `${actor} invited you to join ${communityTitle}.`;
        case 'COMMUNITY_INVITE_ACCEPTED':
            return `${details.inviteeUsername} accepted your invitation to join ${communityTitle}.`;
        case 'STORE_RATING':
            return `${actor} left a rating on your store, ${storeLabel}.`;
        case 'NEW_LOGIN':
            return `We detected a new login from ${details.device} at ${details.location}.`;
        case 'POST_MENTION':
            return `${actor} mentioned you in a post.`;
        case 'COMMENT_MENTION':
            return `${actor} mentioned you in a comment.`;
        case 'MODERATION_ACTION':
            return `An admin has ${details.action} you in ${details.chatGroupTitle}.`;
        default:
            return 'You have a new notification.';
    }
};


export const createNotification = async (type, senderId, recipientId, entityIds = {}, details = {}) => {
  // PREVENT SELF-NOTIFICATIONS
  if (senderId === recipientId) {
    return;
  }

  try {
    const q = `INSERT INTO notifications (type, senderId, recipientId, postId, communityId, storeId, details, createdAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
      type,
      senderId,
      recipientId,
      entityIds.postId || null,
      entityIds.communityId || null,
      entityIds.storeId || null,
      JSON.stringify(details),
      new Date()
    ];

    const [result] = await db.promise().query(q, values);
    const notificationId = result.insertId;

    const [sender] = await db.promise().query("SELECT username FROM users WHERE id = ?", [senderId]);
    const senderUsername = sender.length > 0 ? sender[0].username : 'Someone';
    
    // CONSTRUCT THE NOTIFICATION MESSAGE
    const messageBody = constructNotificationMessage({ type, senderUsername, details, ...details });

    // DEFINE MESSAGE TITLE
    const messageTitle = "You have a new notification";

    // PREPARE DATA PAYLOAD
    const dataPayload = {
        notificationId: String(notificationId),
        type,
        ...entityIds
    };
    
    // Trigger the push notification
    await sendPushNotification(recipientId, messageTitle, messageBody, dataPayload);

    // Trigger email notification (optional, can be kept for certain types)
    await sendNotificationEmail(recipientId, senderId, type, details);

  } catch (err) {
    console.error(`[Notification Error] Failed to create notification:`, err);
  }
};

// REGISTER A DEVICE TOKEN FOR PUSH NOTIFICATIONS
export const registerDevice = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const { fcmToken, deviceType } = req.body;

            if (!fcmToken) {
                return res.status(400).json({ message: "fcmToken is required." });
            }

            // INSERT NEW TOKEN OR UPDATE EXISTING ONE FOR A USER'S DEVICE
            const query = `
                INSERT INTO user_devices (userId, fcmToken, deviceType)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE userId = ?, deviceType = ?
            `;
            await db.promise().query(query, [userId, fcmToken, deviceType || 'web', userId, deviceType || 'web']);

            res.status(200).json({ message: "Device registered successfully." });

        } catch (err) {
            console.error("[FCM Register Error]:", err);
            res.status(500).json({ message: "Failed to register device.", error: err.message });
        }
    });
};

// GET ALL NOTIFICATIONS FOR A USER
export const getNotifications = (req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const userId = req.user.id;
      const q = `
        SELECT n.*, u.username AS senderUsername, u.profilePic AS senderProfilePic,
               c.title AS communityTitle, s.label AS storeLabel
        FROM notifications AS n
        JOIN users AS u ON n.senderId = u.id
        LEFT JOIN communities c ON n.communityId = c.id
        LEFT JOIN stores s ON n.storeId = s.id
        WHERE n.recipientId = ?
        ORDER BY n.createdAt DESC
        LIMIT 50; 
      `;

      const [notifications] = await db.promise().query(q, [userId]);
      // PROCESS EACH NOTIFICATION
      const processedNotifications = notifications.map(n => {
          n.senderProfilePic = processImageUrl(n.senderProfilePic);
          try {
              n.details = n.details ? JSON.parse(n.details) : {}; //Json
          } catch (e) {
              n.details = {};
          }
          // CONSTRUCT THE NOTIFICATION MESSAGE FOR FRONTEND DISPLAY
          n.message = constructNotificationMessage(n);
          return n;
      });

      res.status(200).json(processedNotifications);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      res.status(500).json({ message: "Failed to fetch notifications.", error: err.message });
    }
  });
};

// MARK NOTIFICATIONS AS READ
export const markAsRead = (req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const userId = req.user.id;
      const q = "UPDATE notifications SET \`read\` = 1 WHERE recipientId = ? AND \`read\` = 0";
      await db.promise().query(q, [userId]);
      res.status(200).json({ message: "Notifications marked as read." });
    } catch (err) {
      console.error("Error marking notifications as read:", err);
      res.status(500).json({
        message: "Failed to mark notifications as read.",
        error: err.message,
      });
    }
  });
};

export const deleteNotification = async (type, senderId, recipientId, entityIds = {}) => {
  try {
    let conditions = "type = ? AND senderId = ? AND recipientId = ?";
    const values = [type, senderId, recipientId];

    if (entityIds.postId) {
      conditions += " AND postId = ?";
      values.push(entityIds.postId);
    }
    if (entityIds.commentId) {
      conditions += " AND commentId = ?";
      values.push(entityIds.commentId);
    }
    // Add other entities as needed...

    const q = `DELETE FROM notifications WHERE ${conditions}`;
    await db.promise().query(q, values);

  } catch (err) {
    console.error(`[Notification Error] Failed to delete notification:`, err);
  }
};

// NEW: API TO UNREGISTER A DEVICE TOKEN
export const unregisterDevice = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const { fcmToken } = req.body;

            if (!fcmToken) {
                return res.status(400).json({ message: "fcmToken is required." });
            }

            await db.promise().query("DELETE FROM user_devices WHERE fcmToken = ?", [fcmToken]);

            res.status(200).json({ message: "Device unregistered successfully." });

        } catch (err) {
            console.error("[FCM Unregister Error]:", err);
            res.status(500).json({ message: "Failed to unregister device.", error: err.message });
        }
    });
};