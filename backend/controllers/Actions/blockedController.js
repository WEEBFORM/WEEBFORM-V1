import { executeQuery } from "../../middlewares/dbExecute.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import { generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";
import NodeCache from 'node-cache';

const blockedUsersCache = new NodeCache({ stdTTL: 300 });

// API TO BLOCK USER
export const blockUser = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const blockedUser = parseInt(req.params.blockedUser);

        if (!Number.isInteger(blockedUser)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        if (blockedUser === userId) {
            return res.status(409).json({ message: "Cannot block yourself" });
        }

        try {
            const q = "SELECT * FROM blocked_users WHERE blockedUserId = ? AND userId = ?";
            const blocked = await executeQuery(q, [blockedUser, userId]);

            if (blocked && blocked.length > 0) {
                return res.status(409).json({ message: "User has been blocked already!" });
            }

            const insertQuery = "INSERT INTO blocked_users (blockedUserId, userId) VALUES(?, ?)";
            await executeQuery(insertQuery, [blockedUser, userId]); 
            blockedUsersCache.flushAll();
            return res.status(200).json({ message: "User blocked successfully" });
        } catch (err) {
            console.error("Block User error:", err);
            return res.status(500).json({ message: "Failed to block user", error: err.message });
        }
    });
};

// API TO UNBLOCK USER
export const unblockUser = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const blockedUser = parseInt(req.params.blockedUser);

        if (!Number.isInteger(blockedUser)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        try {
            const deleteQuery = "DELETE FROM blocked_users WHERE blockedUserId = ? AND userId = ?";
            const result = await executeQuery(deleteQuery, [blockedUser, userId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User is not blocked" });
            }

            blockedUsersCache.flushAll();
            return res.status(200).json({ message: "User unblocked successfully" });
        } catch (err) {
            console.error("Unblock User error:", err);
            return res.status(500).json({ message: "Failed to unblock user", error: err.message });
        }
    });
};

// API TO GET BLOCKED USERS
export const getBlockedUsers = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const cacheKey = `blockedUsers:${userId}`;

        try {
            const cachedData = blockedUsersCache.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(cachedData);
            }

            const q = `
                SELECT
                    u.id,
                    u.full_name,
                    u.username,
                    u.profilePic
                FROM blocked_users AS bu
                JOIN users AS u ON bu.blockedUserId = u.id
                WHERE bu.userId = ?
            `;
            
            const blockedUsers = await executeQuery(q, [userId]);

            if (blockedUsers.length === 0) {
                return res.status(200).json([]);
            }

            const processedBlockedUsers = await Promise.all(
                blockedUsers.map(async (user) => {
                    if (user.profilePic) {
                        try {
                            const profilePicKey = s3KeyFromUrl(user.profilePic);
                            user.profilePic = await generateS3Url(profilePicKey);
                        } catch (error) {
                            console.error(`Error generating S3 URL for blocked user ${user.id}:`, error);
                            user.profilePic = null;
                        }
                    }
                    return user;
                })
            );
            
            blockedUsersCache.set(cacheKey, processedBlockedUsers);

            return res.status(200).json(processedBlockedUsers);

        } catch (err) {
            console.error("Get Blocked Users error:", err);
            return res.status(500).json({ message: "Failed to get blocked users", error: err.message });
        }
    });
};