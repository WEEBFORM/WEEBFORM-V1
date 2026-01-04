import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";

//FETCH USER SETTINGS, CREATE DEFAULT IF NONE
export const getSettings = async (req, res) => {
    authenticateUser(req, res, async () => {
        console.log('DEBUG: req.user object is:', req.user);
        const userId = req.user.id;

        if (!userId) { 
            return res.status(400).json({ message: "User ID could not be determined from token." });
        }
        try {
            const getQuery = "SELECT * FROM user_settings WHERE userId = ?";
            const [rows] = await db.promise().query(getQuery, [userId]);

            if (rows.length > 0) {
                return res.status(200).json(rows[0]);
            } else {
                // NO SETTINGS FOUND, CREATE DEFAULT
                const insertQuery = "INSERT INTO user_settings (userId) VALUES (?)";
                await db.promise().query(insertQuery, [userId]);

                // FETCH THE NEWLY CREATED DEFAULT SETTINGS
                const [newRows] = await db.promise().query(getQuery, [userId]);
                return res.status(200).json(newRows[0]);
            }
        } catch (error) {
            console.error(`[Settings] Error fetching settings for user ${userId}:`, error);
            return res.status(500).json({ message: "Failed to fetch user settings.", error: error.message });
        }
    });
};

//UPDATE USER SETTINGS
export const updateSettings = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const updates = req.body;

        // VALIDATE INPUT FIELDS
        const allowedFields = [
            'anime_genres', 'profile_visibility', 
            'show_online_status', 'notifications_push', 'notifications_new_episodes',
            'notifications_community', 'notifications_marketplace', 'notifications_email',
            'app_theme', 'app_language', 'autoplay_videos', 'data_saver_mode', 'store_settings'
        ];

        const setClauses = [];
        const values = [];

        for (const key in updates) {
            if (allowedFields.includes(key)) {
                setClauses.push(`\`${key}\` = ?`);
                const value = typeof updates[key] === 'object' && updates[key] !== null 
                    ? JSON.stringify(updates[key]) 
                    : updates[key];
                values.push(value);
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ message: "No valid settings fields provided for update." });
        }

        values.push(userId);

        const updateQuery = `UPDATE user_settings SET ${setClauses.join(', ')} WHERE userId = ?`;

        try {
            const [result] = await db.promise().query(updateQuery, values);

            if (result.affectedRows > 0) {
                return res.status(200).json({ message: "Settings updated successfully." });
            } else {
                return res.status(200).json({ message: "Settings processed. No changes were applied." });
            }
        } catch (error) {
            console.error(`[Settings] Error updating settings for user ${userId}:`, error);
            return res.status(500).json({ message: "Failed to update user settings.", error: error.message });
        }
    });
};