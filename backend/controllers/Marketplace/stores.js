import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import { processImageUrl, resizeImage } from '../../middlewares/cloudfrontConfig.js';
import { createStoreVisit } from "./ratings.js";

//HELPER TO PROCESS STORE IMAGES
const processStoreImages = (stores) => {
    return stores.map(store => {
        if (store.logoImage) {
            store.logoImage = processImageUrl(store.logoImage);
        }
        if (store.ownerProfilePic) {
            store.ownerProfilePic = processImageUrl(store.ownerProfilePic);  
        }
        return store;
    });
};

// CREATE NEW STORE
export const newStore = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err) return res.status(400).json({ message: "File upload error", error: err.message });
            
            const user = req.user;
            if (user.role !== 'admin' && user.role !== 'premium') {
                try {
                    const [data] = await db.promise().query("SELECT COUNT(*) AS storeCount FROM stores WHERE ownerId = ?", [user.id]);
                    if (data[0].storeCount >= 1) {
                        return res.status(403).json({ message: "Basic users can only create one store. Upgrade to premium!" });
                    }
                } catch (dbErr) {
                    return res.status(500).json({ message: "Database query error", error: dbErr.message });
                }
            }
            await handleNewStore(req, res, user);
        });
    });
};
 
async function handleNewStore(req, res, user) {
    try {
        let logoImageKey = null;
        if (req.files && req.files.logoImage && req.files.logoImage[0]) {
            const photo = req.files.logoImage[0];
            const resizedBuffer = await resizeImage(photo.buffer, 200, 200); // Optimize logo
            const key = `uploads/stores/${Date.now()}_${photo.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
            
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: key,
                Body: resizedBuffer,
                ContentType: 'image/webp',
            };
            await s3.send(new PutObjectCommand(params));
            logoImageKey = key;
        }

        const insertQuery = `
            INSERT INTO stores (ownerId, label, description, logoImage, category, web_link, created)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            user.id, req.body.label, req.body.description, logoImageKey,
            req.body.category, req.body.web_link, moment().format("YYYY-MM-DD HH:mm:ss"),
        ];

        const [data] = await db.promise().query(insertQuery, values);
        return res.status(200).json({
            message: `New store ${req.body.label} created successfully`,
            storeId: data.insertId
        });
    } catch (error) {
        console.error("Error creating new store:", error);
        return res.status(500).json({ message: "Failed to create store", error: error.message });
    }
}

// API TO VIEW STORES CREATED BY THE USER
export const getCreatedStores = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const q = `
                SELECT s.*, u.username AS ownerUsername, u.profilePic AS ownerProfilePic,
                       COALESCE(AVG(sr.rating), 0) AS averageRating, COUNT(sr.id) AS totalRatings
                FROM stores AS s
                JOIN users AS u ON u.id = s.ownerId
                LEFT JOIN store_ratings AS sr ON s.id = sr.storeId
                WHERE s.ownerId = ?
                GROUP BY s.id;
            `;

            const [stores] = await db.promise().query(q, [userId]);
            const processedStores = processStoreImages(stores);

            res.status(200).json(processedStores);
        } catch (error) {
            console.error("Error in getCreatedStores:", error);
            res.status(500).json({ message: "Failed to fetch created stores", error: error.message });
        }
    });
};

//API TO VIEW ALL STORES
export const viewStores = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const q = `
              SELECT s.*, u.username AS ownerUsername, u.profilePic AS ownerProfilePic,
                     COALESCE(AVG(sr.rating), 0) AS averageRating, COUNT(sr.rating) AS totalRatings
              FROM stores AS s
              JOIN users AS u ON u.id = s.ownerId
              LEFT JOIN store_ratings AS sr ON s.id = sr.storeId
              GROUP BY s.id;
            `;
    
            const [stores] = await db.promise().query(q);
            const processedStores = processStoreImages(stores);
    
            const sortedStores = [...processedStores].sort((a, b) => b.averageRating - a.averageRating);
            const specialStores = sortedStores.slice(0, 10);
            const availableStores = shuffleStores(processedStores);
    
            res.status(200).json({ availableStores, specialStores });
        } catch (error) {
            console.error("Error in viewStores:", error);
            res.status(500).json({ message: "Failed to fetch stores", error: error.message });
        }
    });
};

//API TO VIEW A SINGLE STORE
export const viewSingleStore = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const storeId = req.params.id;
            const userId = req.user.id;

            const q = `
                SELECT s.*, 
                       u.username AS ownerUsername, 
                       u.profilePic AS ownerProfilePic,
                       (SELECT AVG(rating) FROM store_ratings WHERE storeId = s.id) AS averageRating,
                       (SELECT COUNT(*) FROM store_ratings WHERE storeId = s.id) AS totalRatings,
                       (SELECT COUNT(*) FROM store_visits WHERE storeId = s.id) AS visitCount
                FROM stores AS s
                JOIN users AS u ON u.id = s.ownerId
                WHERE s.id = ?;
            `;

            const [data] = await db.promise().query(q, [storeId]);
            if (data.length === 0) return res.status(404).json({ message: 'Store not found' });

            const [store] = processStoreImages(data);
            createStoreVisit(userId, storeId);

            // Calculate time since creation
            const creationDate = moment(store.created);
            const now = moment();
            const diffInDays = now.diff(creationDate, 'days');

            let timeSinceCreation;
            if (diffInDays < 1) {
                timeSinceCreation = "Less than a day";
            } else if (diffInDays === 1) {
                timeSinceCreation = "1 day";
            } else if (diffInDays < 7) {
                timeSinceCreation = `${diffInDays} days`;
            } else if (diffInDays < 30) {
                timeSinceCreation = `${Math.floor(diffInDays / 7)} weeks`;
            } else if (diffInDays < 365) {
                timeSinceCreation = `${Math.floor(diffInDays / 30)} months`;
            } else {
                timeSinceCreation = `${Math.floor(diffInDays / 365)} years`;
            }

            res.status(200).json({
                ...store,
                averageRating: store.averageRating ? parseFloat(store.averageRating).toFixed(1) : "0.0",
                totalRatings: store.totalRatings || 0,
                visitCount: store.visitCount || 0,
                timeSinceCreation: timeSinceCreation
            });

        } catch (error) {
            console.error("Error in viewSingleStore:", error);
            res.status(500).json({ message: "Failed to fetch store", error: error.message });
        }
    });
};

// API TO EDIT STORE INFO/DATA
export const editStoreDetails = async (req, res) => {
    authenticateUser(req, res, async () => {
        const currentUserId = req.user.id;
        const storeId = req.params.id;
        if (!storeId || isNaN(Number(storeId))) {
            return res.status(400).json({ message: "Invalid or missing store ID." });
        }

        try {
            const [storeDataRows] = await db.promise().query("SELECT ownerId, logoImage FROM stores WHERE id = ?", [storeId]);
            if (storeDataRows.length === 0) return res.status(404).json({ message: "Store not found." });
            
            const existingStore = storeDataRows[0];
            if (existingStore.ownerId !== currentUserId) {
                return res.status(403).json({ message: "You are not authorized to edit this store." });
            }

            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr) return res.status(400).json({ message: "File upload error", error: uploadErr.message });
                
                let newImageKey = null;
                try {
                    if (req.files && req.files.logoImage && req.files.logoImage[0]) {
                        const logoFile = req.files.logoImage[0];
                        const resizedBuffer = await resizeImage(logoFile.buffer, 200, 200);
                        const key = `uploads/stores/${storeId}_logo_${Date.now()}_${logoFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                        
                        await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' }));
                        newImageKey = key;
                    }
                } catch (imageUploadError) {
                    return res.status(500).json({ message: "Failed to upload logo image", error: imageUploadError.message });
                }

                const updateFieldsPayload = {};
                const values = [];
                const setClauses = [];
                const allowedTextFields = { label: 'label', description: 'description', category: 'category', web_link: 'web_link' };

                for (const key in allowedTextFields) {
                    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                        setClauses.push(`${allowedTextFields[key]} = ?`);
                        values.push(req.body[key]);
                        updateFieldsPayload[allowedTextFields[key]] = req.body[key];
                    }
                }

                if (newImageKey) {
                    setClauses.push(`logoImage = ?`);
                    values.push(newImageKey);
                }

                if (setClauses.length === 0) {
                    return res.status(200).json({ message: "No changes were submitted." });
                }
                
                values.push(storeId);
                const sqlQuery = `UPDATE stores SET ${setClauses.join(', ')} WHERE id = ?`;

                try {
                    const [result] = await db.promise().query(sqlQuery, values);
                    if (result.affectedRows > 0) {
                        if (newImageKey) {
                            updateFieldsPayload.logoImage = processImageUrl(newImageKey);
                            if (existingStore.logoImage) await deleteS3Object(existingStore.logoImage);
                        }
                        res.status(200).json({ message: "Store details updated successfully", updatedFields: updateFieldsPayload });
                    } else {
                        res.status(200).json({ message: "No changes needed or applied.", updatedFields: updateFieldsPayload });
                    }
                } catch (dbError) {
                    if (newImageKey) await deleteS3Object(newImageKey);
                    return res.status(500).json({ message: "Failed to update store in database", error: "Database error" });
                }
            });
        } catch (error) {
            console.error(`Unexpected error in editStoreDetails handler for store ID ${storeId}:`, error);
            res.status(500).json({ message: "Failed to edit store details.", error: "Internal server error" });
        }
    });
};

//API TO DELETE STORE
export const closeStore = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const storeId = req.params.id;
            
            const [data] = await db.promise().query("SELECT logoImage FROM stores WHERE id = ? AND ownerId = ?", [storeId, userId]);
            if (data.length === 0) {
                return res.status(404).json({ message: "Store not found or you are not authorized." });
            }

            const logoImageKey = data[0].logoImage;
            if (logoImageKey) {
                await deleteS3Object(logoImageKey);
            }

            await db.promise().query("DELETE FROM stores WHERE id = ? AND ownerId = ?", [storeId, userId]);
            return res.status(200).json({ message: "Store deleted successfully." });

        } catch (error) {
            console.error("Error deleting store:", error);
            return res.status(500).json({ message: "Failed to delete store", error: error.message });
        }
    });
};

const shuffleStores = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};