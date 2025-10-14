import { transporter } from "../middlewares/mailTransportConfig.js";
import { db } from "../config/connectDB.js";

// HELPER TO GET USER INFO AND EMAIL SETTINGS
const getUserInfoForEmail = async (userId) => {
  try {
    const [user] = await db.promise().query("SELECT email, username FROM users WHERE id = ?", [userId]);
    if (user.length === 0) return null;

    // --- FIX: Query for `notifications_email` to correctly check email preferences ---
    const [settings] = await db.promise().query("SELECT notifications_email FROM user_settings WHERE userId = ?", [userId]);

    return {
      email: user[0].email,
      username: user[0].username,
      // --- FIX: Use the correct property (`notifications_email`) and default to true ---
      emailNotificationsEnabled: settings.length > 0 ? settings[0].notifications_email : true,
    };
  } catch (error) {
    console.error(`[Mail Error] Failed to fetch user info for email (User ID: ${userId}):`, error);
    return null;
  }
};

// GET SENDER'S USERNAME
const getSenderUsername = async (senderId) => {
  try {
    const [user] = await db.promise().query("SELECT username FROM users WHERE id = ?", [senderId]);
    return user.length > 0 ? user[0].username : "Someone";
  } catch (error) {
    console.error(`[Mail Error] Failed to fetch sender username (Sender ID: ${senderId}):`, error);
    return "Someone";
  }
};

// NOTIFICATION EMAIL SENDER
export const sendNotificationEmail = async (recipientId, senderId, type, details = {}) => {
  try {
    const recipientInfo = await getUserInfoForEmail(recipientId);

    // This check will now work correctly
    if (!recipientInfo || !recipientInfo.emailNotificationsEnabled) {
      console.log(`[Mail Info] Email notifications disabled or user not found for recipientId: ${recipientId}`);
      return;
    }

    const senderUsername = await getSenderUsername(senderId);
    const { subject, text } = getNotificationMessage(type, senderUsername, details);

    if (!subject || !text) {
      console.log(`[Mail Info] No email template for notification type: ${type}`);
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientInfo.email,
      subject: subject,
      text: text,
    };

    transporter.sendMail(mailOptions);
    console.log(`[Mail Info] Notification email sent to ${recipientInfo.email} for type: ${type}`);

  } catch (error) {
    console.error("[Mail Error] General error in sendNotificationEmail:", error);
  }
};

// CONSTRUCTS RICH EMAIL CONTENT FOR ALL NOTIFICATION TYPES
const getNotificationMessage = (type, senderUsername, details) => {
  // Use the details object for more specific information when available
  const actor = details.senderUsername || details.postAuthorUsername || senderUsername;

  switch (type) {
    case "LIKE_POST":
      return {
        subject: `${actor} liked your post`,
        text: `Hi there,\n\n${actor} just liked one of your posts on Weebform.\n\n- The Weebform Team`
      };
    case "NEW_POST_FROM_FOLLOWING":
      return {
        subject: `New Post from ${actor}`,
        text: `${actor} just shared a new post. Check it out!`
      };
    case "FOLLOW":
       return {
         subject: `${actor} is now following you`,
         text: `Good news! ${actor} just started following you on Weebform.`
       };
    case "COMMENT_ON_POST":
    case "REPLY_TO_COMMENT":
    case "REPLY_TO_REPLY":
        return {
            subject: `${actor} replied to you`,
            text: `${actor} left a new reply on Weebform.`
        };
    case "COMMUNITY_JOIN":
      return {
        subject: "New Community Member",
        text: `${actor} joined your community, ${details.communityTitle}.`
      };
    case "COMMUNITY_INVITE":
      return {
        subject: `You're Invited to Join ${details.communityTitle}`,
        text: `${actor} has invited you to join the private community: ${details.communityTitle}.`
      };
    case "COMMUNITY_INVITE_ACCEPTED":
       return {
         subject: `${details.inviteeUsername} Accepted Your Invitation`,
         text: `${details.inviteeUsername} has accepted your invitation and joined ${details.communityTitle}.`
       };
    case "STORE_RATING":
      return {
        subject: "Your Store Received a New Rating",
        text: `${actor} left a rating on your store, ${details.storeLabel}.`
      };
    case "NEW_LOGIN":
       return {
        subject: "New Login to Your Weebform Account",
        text: `We detected a new login to your account from ${details.device} at ${details.location}. If this wasn't you, please secure your account.`
      };
    case "MODERATION_ACTION":
       return {
         subject: "Moderation Action Taken on Your Account",
         text: `An admin has ${details.action} you in ${details.chatGroupTitle}. Duration: ${details.duration || 'Permanent'}.`
       };
    default:
      // Return an empty object so no generic email is sent for unhandled types
      return {};
  }
};