import { executeQuery } from "../../middlewares/dbExecute.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
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
            const q = "SELECT * FROM blocked_users WHERE blocked_id = ? AND user_id = ?";
            const blocked = await executeQuery(q, [blockedUser, userId]);

            if (blocked && blocked.length > 0) {
                return res.status(409).json({ message: "User has been blocked already!" });
            }

            const insertQuery = "INSERT INTO blocked_users (blocked_id, user_id) VALUES(?, ?)";
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
            const deleteQuery = "DELETE FROM blocked_users WHERE blocked_id = ? AND user_id = ?";
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

        try {
            const q = "SELECT blocked_id FROM blocked_users WHERE user_id = ?";
            const blockedUsers = await executeQuery(q, [userId]);
            const blockedUserIds = blockedUsers.map(user => user.blocked_id);

            return res.status(200).json(blockedUserIds);
        } catch (err) {
            console.error("Get Blocked Users error:", err);
            return res.status(500).json({ message: "Failed to get blocked users", error: err.message });
        }
    });
};