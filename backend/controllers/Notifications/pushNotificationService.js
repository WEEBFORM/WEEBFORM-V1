import { db } from "../../config/connectDB.js";
import admin from "../../config/firebaseAdmin.js";

// SEND PUSH NOTIFICATION USING FCM
export const sendPushNotification = async (recipientId, title, body, data = {}) => {
    try {
        const [devices] = await db.promise().query("SELECT fcmToken FROM user_devices WHERE userId = ?", [recipientId]);

        if (devices.length === 0) {
            console.log(`[FCM] No registered devices found for userId: ${recipientId}. Skipping push notification.`);
            return;
        }

        const tokens = devices.map(device => device.fcmToken);

        const message = {
            notification: { title, body },
            data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
            tokens: tokens, 
        };

        // USING `sendEachForMulticast` TO HANDLE MULTIPLE TOKENS
        const response = await admin.messaging().sendEachForMulticast(message);
        
        console.log(`[FCM] Notification sent for userId: ${recipientId}. Success: ${response.successCount}, Failure: ${response.failureCount}`);

        if (response.failureCount > 0) {
            const tokensToDelete = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error.code;
                    if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                        tokensToDelete.push(tokens[idx]);
                    }
                }
            });

            if (tokensToDelete.length > 0) {
                console.log(`[FCM] Deleting ${tokensToDelete.length} stale tokens.`);
                await db.promise().query("DELETE FROM user_devices WHERE fcmToken IN (?)", [tokensToDelete]);
            }
        }

    } catch (error) {
        console.error(`[FCM Error] Failed to send push notification to userId ${recipientId}:`, error);
    }
};