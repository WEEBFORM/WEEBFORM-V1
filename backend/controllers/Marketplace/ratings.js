import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";

// API TO RATE A STORE
export const rateStore = (req, res) => {
    authenticateUser(req, res, () => {
        const userId = req.user.id;
        const storeId = req.params.storeId;
        const { rating } = req.body;

        if (!Number.isInteger(Number(storeId))) {
            return res.status(400).json({ message: "Invalid store ID" });
        }

        if (!Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be an integer between 1 and 5." });
        }

        //CHECK RATING STATUS
        const checkQuery = "SELECT * FROM store_ratings WHERE storeId = ? AND userId = ?";
        db.query(checkQuery, [storeId, userId], (err, data) => {
            if (err) {
                console.error("Error checking existing rating:", err);
                return res.status(500).json({ message: "Database error", error: err });
            }

            if (data.length > 0) {
                // Update existing rating
                const updateQuery = "UPDATE store_ratings SET rating = ? WHERE storeId = ? AND userId = ?";
                db.query(updateQuery, [rating, storeId, userId], (updateErr) => {
                    if (updateErr) {
                        console.error("Error updating rating:", updateErr);
                        return res.status(500).json({ message: "Database error", error: updateErr });
                    }
                    return res.status(200).json({ message: "Rating updated successfully." });
                });
            } else {
                // INSERT NEW RATING
                const insertQuery = "INSERT INTO store_ratings (storeId, userId, rating, createdAt) VALUES (?, ?, ?, ?)";
                const values = [storeId, userId, rating, moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")];
                db.query(insertQuery, values, (insertErr) => {
                    if (insertErr) {
                        console.error("Error inserting rating:", insertErr);
                        return res.status(500).json({ message: "Database error", error: insertErr });
                    }
                    return res.status(201).json({ message: "Rating submitted successfully." });
                });
            }
        });
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
        const averageRating = parseFloat(data[0].averageRating).toFixed(1); //to show as a decimal instead of showing as a whole number.

        res.status(200).json({
            averageRating: averageRating,
            totalRatings: data[0].totalRatings,
        });
    });
};

// API TO RECORD STORE VISIT
export const recordStoreVisit = (req, res) => {
    authenticateUser(req, res, () => {
        const userId = req.user.id;
        const storeId = req.params.storeId;

        if (!Number.isInteger(Number(storeId))) {
            return res.status(400).json({ message: "Invalid store ID" });
        }

        // Check if the visit already exists for the user and store.
        const checkQuery = "SELECT id FROM store_visits WHERE storeId = ? AND userId = ?";
        db.query(checkQuery, [storeId, userId], (checkErr, checkData) => {
            if (checkErr) {
                console.error("Error checking existing visit:", checkErr);
                return res.status(500).json({ message: "Database error", error: checkErr });
            }

            if (checkData.length === 0) {
                // If visit doesn't exist, create a new record.
                const insertQuery = "INSERT INTO store_visits (storeId, userId, visitedAt) VALUES (?, ?, ?)";
                const values = [storeId, userId, moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")];

                db.query(insertQuery, values, (insertErr) => {
                    if (insertErr) {
                        console.error("Error recording store visit:", insertErr);
                        return res.status(500).json({ message: "Failed to record store visit", error: insertErr });
                    }

                    return res.status(201).json({ message: "Store visit recorded successfully." });
                });
            } else {
                // If visit already exists, do nothing and return OK. (Idempotent)
                return res.status(200).json({ message: "Store visit already recorded." });
            }
        });
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