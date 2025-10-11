import { db } from "../../../config/connectDB.js";
import { authenticateUser } from "../../../middlewares/verify.mjs";
import { s3 } from "../../../middlewares/S3bucketConfig.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer from 'multer';
import { processImageUrl } from '../../../middlewares/cloudfrontConfig.js';

const upload = multer({ storage: multer.memoryStorage() });

export const uploadMessageMedia = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            if (!req.file) {
                return res.status(400).send({ message: "No file was uploaded." });
            }
            const key = `uploads/messages/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
            const params = { Bucket: process.env.BUCKET_NAME, Key: key, Body: req.file.buffer, ContentType: req.file.mimetype };
            
            await s3.send(new PutObjectCommand(params));
            
            // Return the KEY, not the full URL
            res.status(200).send({ mediaKey: key });
        } catch (error) {
            console.error("Error uploading file:", error);
            res.status(500).send({ message: "Error uploading file.", error: error.message });
        }
    });
};

export const fetchGroupMessages = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const { chatGroupId } = req.params;
            const query = `
                SELECT 
                    gm.id, gm.userId as senderId, gm.chatGroupId, gm.text as message, gm.media, gm.createdAt,
                    u.full_name, u.profilePic,
                    gm.replyToMessageId,
                    reply_msg.text as replyToMessage,
                    reply_user.full_name as replyToUsername,
                    reply_user.profilePic as replyToProfilePic,
                    gm.audio, gm.threadId, gm.spoiler, gm.mentions
                FROM groupmessages gm
                JOIN users u ON gm.userId = u.id
                LEFT JOIN groupmessages reply_msg ON gm.replyToMessageId = reply_msg.id
                LEFT JOIN users reply_user ON reply_msg.userId = reply_user.id
                WHERE gm.chatGroupId = ?
                ORDER BY gm.createdAt ASC;
            `;

            const [results] = await db.promise().query(query, [chatGroupId]);

            const messages = results.map(row => {
                const replyTo = row.replyToMessageId ? {
                    messageId: row.replyToMessageId,
                    message: row.replyToMessage,
                    full_name: row.replyToUsername,
                    profilePic: processImageUrl(row.replyToProfilePic),
                } : null;

                let mentionedUsers = [];
                try {
                    if (row.mentions) mentionedUsers = JSON.parse(row.mentions);
                } catch (e) {
                    console.error(`Failed to parse mentions for message ${row.id}:`, e);
                }

                return {
                    id: row.id,
                    senderId: row.senderId,
                    chatGroupId: row.chatGroupId,
                    message: row.message,
                    media: row.media ? row.media.split(',').map(key => processImageUrl(key.trim())) : [],
                    createdAt: row.createdAt,
                    full_name: row.full_name,
                    profilePic: processImageUrl(row.profilePic),
                    replyTo: replyTo,
                    audio: processImageUrl(row.audio),
                    threadId: row.threadId,
                    spoiler: row.spoiler === 1,
                    mentions: mentionedUsers,
                };
            });
            
            return res.json(messages);

        } catch (err) {
            console.error("Error fetching group messages:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });
}; 

export const editMessage = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const { messageId } = req.params;
            const { message } = req.body;
            await db.promise().query("UPDATE groupmessages SET text = ? WHERE id = ?", [message, messageId]);
            res.status(200).json({ message: "Message updated successfully" });
        } catch (err) {
            console.error("Error updating message:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });
};

export const deleteMessage = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const { messageId } = req.params;
            
            const [result] = await db.promise().query("SELECT media, audio FROM groupmessages WHERE id = ?", [messageId]);
            if (result && result.length > 0) {
                const { media, audio } = result[0];
                const keysToDelete = [];
                if (media) keysToDelete.push(...media.split(','));
                if (audio) keysToDelete.push(audio);
                
                if (keysToDelete.length > 0) {
                    await Promise.all(keysToDelete.map(key => deleteS3Object(key.trim())));
                }
            }

            await db.promise().query("DELETE FROM groupmessages WHERE id = ?", [messageId]);
            res.status(200).json({ message: "Message deleted successfully" });
        } catch (err) {
            console.error("Error deleting message:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });
};

export const uploadSingle = upload.single("media");