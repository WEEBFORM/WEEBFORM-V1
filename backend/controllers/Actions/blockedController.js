import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import NodeCache from 'node-cache';
import { processImageUrl } from '../../middlewares/cloudfrontConfig.js';

const blockedUsersCache = new NodeCache({ stdTTL: 300 });

// API TO BLOCK A USER
export const blockUser = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const blockedUserId = parseInt(req.params.blockedUser);
    
            if (!Number.isInteger(blockedUserId)) {
                return res.status(400).json({ message: "Invalid user ID" });
            }
    
            if (blockedUserId === userId) {
                return res.status(409).json({ message: "Cannot block yourself" });
            }
    
            const [existing] = await db.promise().query("SELECT * FROM blocked_users WHERE userId = ? AND blockedUserId = ?", [userId, blockedUserId]);
            if (existing.length > 0) {
                return res.status(409).json({ message: "User is already blocked." });
            }
    
            await db.promise().query("INSERT INTO blocked_users (userId, blockedUserId) VALUES(?, ?)", [userId, blockedUserId]); 
            blockedUsersCache.del(`blockedUsers:${userId}`);
            return res.status(200).json({ message: "User blocked successfully" });

        } catch (err) {
            console.error("Block User error:", err);
            return res.status(500).json({ message: "Failed to block user", error: err.message });
        }
    });
};

// API TO UNBLOCK A USER
export const unblockUser = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const blockedUserId = parseInt(req.params.blockedUser);
    
            if (!Number.isInteger(blockedUserId)) {
                return res.status(400).json({ message: "Invalid user ID" });
            }
    
            const [result] = await db.promise().query("DELETE FROM blocked_users WHERE userId = ? AND blockedUserId = ?", [userId, blockedUserId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User is not blocked" });
            }
    
            blockedUsersCache.del(`blockedUsers:${userId}`);
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
        try {
            const userId = req.user.id;
            const cacheKey = `blockedUsers:${userId}`;
    
            const cachedData = blockedUsersCache.get(cacheKey);
            if (cachedData) return res.status(200).json(cachedData);
    
            const q = `
                SELECT u.id, u.full_name, u.username, u.profilePic
                FROM blocked_users AS bu
                JOIN users AS u ON bu.blockedUserId = u.id
                WHERE bu.userId = ?;
            `;
            
            const [blockedUsers] = await db.promise().query(q, [userId]);
            if (blockedUsers.length === 0) return res.status(200).json([]);
    
            const processedBlockedUsers = blockedUsers.map(user => {
                user.profilePic = processImageUrl(user.profilePic);
                return user;
            });
            
            blockedUsersCache.set(cacheKey, processedBlockedUsers);
            return res.status(200).json(processedBlockedUsers);

        } catch (err) {
            console.error("Get Blocked Users error:", err);
            return res.status(500).json({ message: "Failed to get blocked users", error: err.message });
        }
    });
};