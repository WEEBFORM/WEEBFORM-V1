import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";

/**
 * Fetches the settings for the authenticated user.
 * If no settings exist for the user, it creates a default entry and returns that.
 */
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
                // User settings found, return them
                return res.status(200).json(rows[0]);
            } else {
                // No settings found for this user, so create a default entry
                console.log(`[Settings] No settings found for user ${userId}. Creating default entry.`);
                const insertQuery = "INSERT INTO user_settings (userId) VALUES (?)";
                await db.promise().query(insertQuery, [userId]);

                // Fetch the newly created default settings to return them
                const [newRows] = await db.promise().query(getQuery, [userId]);
                return res.status(200).json(newRows[0]);
            }
        } catch (error) {
            console.error(`[Settings] Error fetching settings for user ${userId}:`, error);
            return res.status(500).json({ message: "Failed to fetch user settings.", error: error.message });
        }
    });
};

/**
 * Updates the settings for the authenticated user.
 * It dynamically builds the query based on the fields provided in the request body.
 */
export const updateSettings = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const updates = req.body;

        // Define a list of fields that are allowed to be updated to prevent malicious input
        // This should match the columns in your user_settings table
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
                // If the value is an object (for JSON fields), stringify it
                const value = typeof updates[key] === 'object' && updates[key] !== null 
                    ? JSON.stringify(updates[key]) 
                    : updates[key];
                values.push(value);
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ message: "No valid settings fields provided for update." });
        }

        values.push(userId); // Add userId for the WHERE clause

        const updateQuery = `UPDATE user_settings SET ${setClauses.join(', ')} WHERE userId = ?`;

        try {
            const [result] = await db.promise().query(updateQuery, values);

            if (result.affectedRows > 0) {
                return res.status(200).json({ message: "Settings updated successfully." });
            } else {
                // This can happen if the user's settings row didn't exist yet, or if the data was identical.
                // We can try to upsert (insert or update) for robustness, but for now, this is fine.
                // Let's check if the row exists. If not, the 'getSettings' logic will create it on next fetch.
                return res.status(200).json({ message: "Settings processed. No changes were applied." });
            }
        } catch (error) {
            console.error(`[Settings] Error updating settings for user ${userId}:`, error);
            return res.status(500).json({ message: "Failed to update user settings.", error: error.message });
        }
    });
};