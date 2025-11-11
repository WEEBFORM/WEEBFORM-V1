import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { createNotification } from "../Users/notificationsController.js";


//HELPER TO TRACK STORE VISITS
 export const createStoreVisit = async (userId, storeId) => {
    try {
        if (!userId || !storeId) {
            console.warn("[Service] createStoreVisit: Missing userId or storeId.");
            return; 
        }
        const query = `
            INSERT INTO store_visits (storeId, userId, visitedAt) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE visitedAt = VALUES(visitedAt);
        `;
        const values = [storeId, userId, moment().format("YYYY-MM-DD HH:mm:ss")];

        await db.promise().query(query, values);
        console.log(`[Service] Visit recorded for user ${userId} at store ${storeId}.`);

    } catch (error) {
        console.error("Error in createStoreVisit service:", error);
    }
};

// API TO RATE A STORE
export const rateStore = (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const storeId = req.params.storeId;
        const { rating } = req.body;

        if (!Number.isInteger(Number(storeId))) {
            return res.status(400).json({ message: "Invalid store ID" });
        }
        if (!Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be an integer between 1 and 5." });
        }

        try {
            // Get store ownerId and label for the notification
            const [storeData] = await db.promise().query("SELECT ownerId, label FROM stores WHERE id = ?", [storeId]);
            if (storeData.length === 0) {
                return res.status(404).json({ message: "Store not found." });
            }
            const { ownerId, label } = storeData[0];

            const [existingRating] = await db.promise().query("SELECT * FROM store_ratings WHERE storeId = ? AND userId = ?", [storeId, userId]);
            
            let message = "Rating submitted successfully.";
            if (existingRating.length > 0) {
                await db.promise().query("UPDATE store_ratings SET rating = ? WHERE storeId = ? AND userId = ?", [rating, storeId, userId]);
                message = "Rating updated successfully.";
            } else {
                const values = [storeId, userId, rating, moment().format("YYYY-MM-DD HH:mm:ss")];
                await db.promise().query("INSERT INTO store_ratings (storeId, userId, rating, createdAt) VALUES (?, ?, ?, ?)", values);
            }

            // Create notification for the store owner
            await createNotification('STORE_RATING', userId, ownerId, { storeId }, { storeLabel: label });

            return res.status(200).json({ message });

        } catch (err) {
            console.error("Error processing store rating:", err);
            return res.status(500).json({ message: "Database error", error: err.message });
        }
    });
};

// API TO GET AVERAGE STORE RATING AND NUMBER OF RATINGS
export const getAverageStoreRating = (req, res) => {
    const storeId = req.params.storeId;

    if (!Number.isInteger(Number(storeId))) {
        return res.status(400).json({ message: "Invalid store ID" });
    }

    const query = `
        SELECT 
            AVG(rating) AS averageRating,
            COUNT(*) AS totalRatings
        FROM store_ratings
        WHERE storeId = ?
    `;

    db.query(query, [storeId], (err, data) => {
        if (err) {
            console.error("Error fetching average rating:", err);
            return res.status(500).json({ message: "Database error", error: err });
        }

        if (data.length === 0 || data[0].averageRating === null) {
            return res.status(404).json({ message: "Store has not been rated yet.", averageRating: 0, totalRatings: 0 });
        }
        const averageRating = parseFloat(data[0].averageRating).toFixed(1);

        res.status(200).json({
            averageRating: averageRating,
            totalRatings: data[0].totalRatings,
        });
    });
};

// API TO RECORD STORE VISIT
export const recordStoreVisit = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const storeId = req.params.storeId;

            if (!Number.isInteger(Number(storeId))) {
                return res.status(400).json({ message: "Invalid store ID" });
            }
            await createStoreVisit(userId, storeId);
            res.status(200).json({ message: "Store visit recorded." });
        } catch (error) {
            console.error("Error in recordStoreVisit controller:", error);
            res.status(500).json({ message: "Failed to record visit." });
        }
    });
};

// API TO GET STORE VISIT COUNT AND TIME SINCE CREATION
export const getStoreVisitStats = (req, res) => {
    const storeId = req.params.storeId;

    if (!Number.isInteger(Number(storeId))) {
        return res.status(400).json({ message: "Invalid store ID" });
    }

    const visitQuery = `
        SELECT COUNT(*) AS visitCount
        FROM store_visits
        WHERE storeId = ?
    `;

    const creationQuery = `
        SELECT created
        FROM stores
        WHERE id = ?
    `;

    db.query(visitQuery, [storeId], (visitErr, visitData) => {
        if (visitErr) {
            console.error("Error fetching visit count:", visitErr);
            return res.status(500).json({ message: "Database error fetching visit count", error: visitErr });
        }

        const visitCount = visitData[0].visitCount;

        db.query(creationQuery, [storeId], (creationErr, creationData) => {
            if (creationErr) {
                console.error("Error fetching creation date:", creationErr);
                return res.status(500).json({ message: "Database error fetching creation date", error: creationErr });
            }

            if (creationData.length === 0) {
                return res.status(404).json({ message: "Store not found" });
            }

            const creationDate = moment(creationData[0].created);
            const now = moment();
            const diffInDays = now.diff(creationDate, 'days');

            let timeSinceCreation;
            if (diffInDays < 1) {
                timeSinceCreation = "Less than a day";
            } else if (diffInDays === 1) {
                timeSinceCreation = "1 day";
            } else if (diffInDays < 7){
                timeSinceCreation = `${diffInDays} days`
            } else if (diffInDays < 30){
                timeSinceCreation = `${Math.floor(diffInDays / 7)} weeks`
            }else if(diffInDays < 365){
                timeSinceCreation = `${Math.floor(diffInDays / 30)} months`
            }
            else {
                 timeSinceCreation = `${Math.floor(diffInDays / 365)} years`
            }

            res.status(200).json({
                visitCount: visitCount,
                timeSinceCreation: timeSinceCreation,
            });
        });
    });
};