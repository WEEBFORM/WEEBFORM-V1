import {db} from "../../config/connectDB.js"
import { executeQuery } from "../../middlewares/dbExecute.js";
import {authenticateUser} from "../../middlewares/verify.mjs"
import moment from "moment"
import multer from "multer";
import {cpUpload} from "../../middlewares/storage.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import axios from "axios";

//CREATE NEW STORE
export const newStore = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        cpUpload(req, res, async function (err) {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }

            // ROLE CHECK
            if (user.role !== 'admin' && user.role !== 'premium') {
                const checkQuery = "SELECT COUNT(*) AS storeCount FROM stores WHERE ownerId = ?";
                db.query(checkQuery, [user.id], (err, data) => {
                    if (err) {
                        return res.status(500).json({ message: "Database query error", error: err });
                    }

                    const storeCount = data[0].storeCount;
                    if (storeCount >= 1) {
                        return res.status(403).json({ message: "Basic users can only create one store. Upgrade to premium!" });
                    }
                     handleNewStore(req, res, user);

                });
            } else {
                handleNewStore(req, res, user);
            }


        });
    });
};
 
async function handleNewStore(req, res, user){
            let logoImage = null;
            if (req.files && req.files.logoImage && req.files.logoImage[0]) {
                try {
                    const photo = req.files.logoImage[0];
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: `uploads/stores/${Date.now()}_${photo.originalname}`,
                        Body: photo.buffer,
                        ContentType: photo.mimetype,
                    };
                    const command = new PutObjectCommand(params);
                    await s3.send (command); 
                    logoImage = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`; 
                } catch (uploadError) {
                    console.error("Error uploading file:", uploadError);
                    return res.status(500).json({ message: "Error uploading file to S3", error: uploadError });
                }
            }
            const insertQuery = `
                    INSERT INTO stores (ownerId, label, description, logoImage, category, web_link, created)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
            const values = [ 
                user.id,
                req.body.label,
                req.body.description,
                logoImage,
                req.body.category,
                req.body.web_link,
                moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
            ];
            db.query(insertQuery, values, (err, data) => {
                if (err) {
                    return res.status(500).json({ message: "Database insertion error", error: err });
                }
                return res.status(200).json({
                    message: `New store ${req.body.label} created successfully`,
                    storeId: data.insertId,
                    values
                });
            });
}

// API TO VIEW STORES CREATED BY THE USER
export const getCreatedStores = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        console.log(`[Store API] Fetching stores created by user ${userId}.`);

        try {
            const q = `
                SELECT
                    s.*,
                    u.username AS ownerUsername,
                    u.profilePic AS ownerProfilePic,
                    COALESCE(AVG(sr.rating), 0) AS averageRating,
                    COUNT(sr.id) AS totalRatings
                FROM
                    stores AS s
                JOIN
                    users AS u ON u.id = s.ownerId
                LEFT JOIN
                    store_ratings AS sr ON s.id = sr.storeId
                WHERE
                    s.ownerId = ?
                GROUP BY
                    s.id
            `;

            const [data] = await db.promise().query(q, [userId]);

            const processedStores = await Promise.all(
                data.map(async (store) => {
                    if (store.logoImage) {
                        try {
                            store.logoImage = await generateS3Url(s3KeyFromUrl(store.logoImage));
                        } catch (error) {
                            console.error(`Error generating S3 URL for store logo ${store.id}:`, error);
                            store.logoImage = null;
                        }
                    }
                    if (store.ownerProfilePic) {
                        try {
                            store.ownerProfilePic = await generateS3Url(s3KeyFromUrl(store.ownerProfilePic));
                        } catch (error) {
                            console.error(`Error generating S3 URL for owner pic ${store.ownerId}:`, error);
                            store.ownerProfilePic = null;
                        }
                    }
                    return store;
                })
            );

            console.log(`[Store API] Found ${processedStores.length} stores created by user ${userId}.`);
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
          SELECT
            s.*,
            u.username AS ownerUsername,
            u.profilePic AS ownerProfilePic,
            COALESCE(AVG(sr.rating), 0) AS averageRating,
            COUNT(sr.rating) AS totalRatings
          FROM
            stores AS s
          JOIN
            users AS u ON u.id = s.ownerId
          LEFT JOIN
            store_ratings AS sr ON s.id = sr.storeId
          GROUP BY
            s.id
        `;
  
        db.query(q, async (err, data) => {
          if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ message: "Database error", error: err });
          }
  
          const processedStores = await Promise.all(
            data.map(async (store) => {
              if (store.logoImage) {
                try {
                  store.logoImage = await generateS3Url(s3KeyFromUrl(store.logoImage));
                } catch (error) {
                  console.error("Error generating logo image URL:", error);
                  store.logoImage = null;
                }
              }
  
              if (store.ownerProfilePic) {
                try {
                  store.ownerProfilePic = await generateS3Url(
                    s3KeyFromUrl(store.ownerProfilePic)
                  );
                } catch (error) {
                  console.error("Error generating owner profilePic URL:", error);
                  store.ownerProfilePic = null;
                }
              }
  
              return store;
            })
          );
  
          // Sort stores by average rating in descending order
          const sortedStores = [...processedStores].sort(
            (a, b) => b.averageRating - a.averageRating
          );
  
          // Extract top 10 stores for "specialStores"
          const specialStores = sortedStores.slice(0, 10);
  
          const stores = shuffleStores(processedStores)
  
          res.status(200).json({
            availableStores: stores,
            specialStores: specialStores, 
          });
        });
      } catch (error) {
        console.error("Error in viewStores:", error);
        res.status(500).json({ message: "Failed to fetch stores", error: error });
      }
    });
  };

//API TO VIEW A SINGLE STORE
export const viewSingleStore = async (req, res) => {
    authenticateUser(req, res, async () => {
        const storeId = req.params.id;

        const q = `
        SELECT
            s.*,
            u.username AS ownerUsername,
            u.profilePic AS ownerProfilePic,
            (SELECT AVG(rating) FROM store_ratings WHERE storeId = s.id) AS averageRating,
            (SELECT COUNT(*) FROM store_ratings WHERE storeId = s.id) AS totalRatings,
            (SELECT COUNT(*) FROM store_visits WHERE storeId = s.id) AS visitCount
        FROM
            stores AS s
        JOIN
            users AS u ON u.id = s.ownerId
        WHERE s.id = ?
        `;

        db.query(q, [storeId], async (err, data) => {
            if (err) return res.status(500).json(err);

            if (data.length === 0) {
                return res.status(404).json({ message: 'Store not found' });
            }

            const store = data[0]
            if (store.logoImage) {
                const imageKey = s3KeyFromUrl(store.logoImage);
                try {
                    store.logoImage = await generateS3Url(imageKey);
                } catch (error) {
                    console.error("Error generating image URL:", error);
                    store.logoImage = null;
                }
            }
            if (store.ownerProfilePic) {
                const profileKey = s3KeyFromUrl(store.ownerProfilePic);

                try {
                    store.ownerProfilePic = await generateS3Url(profileKey);
                } catch (error) {
                    console.error("Error generating owner profilePic URL:", error);
                    store.ownerProfilePic = null;
                }
            }

            // After successfully fetching the store details, record the visit
            try {
                // Make a request to the recordStoreVisit endpoint
                await axios.post(`http://localhost:8000/api/v1/stores/record-store-visit/${storeId}`, {}, {  // Pass an empty object as data
                    headers: {
                        Cookie: req.get('Cookie')//req.headers.cookie // Forward the cookies, most importantly the access token
                    }
                });

                console.log("Store visit recorded successfully.");
            } catch (visitError) {
                console.error("Error recording store visit:", visitError);
                // Log the error, but don't block the store details response
                // It's important not to break the main functionality
            }

            res.status(200).json({
              ...store,
               averageRating: store.averageRating ? parseFloat(store.averageRating).toFixed(1) : "0.0", //Format average rating if it exists
               totalRatings: store.totalRatings || 0, //Ensure totalRatings always returns a number
                visitCount: store.visitCount || 0
            });
        })
    })
}

// API TO EDIT STORE INFO/DATA - REFACTORED
export const editStoreDetails = async (req, res) => {
    authenticateUser(req, res, async () => {
        const currentUserId = req.user.id;
        const storeId = req.params.id;

        if (!storeId || isNaN(Number(storeId))) {
            return res.status(400).json({ message: "Invalid or missing store ID." });
        }

        try {
            // 1. Fetch existing store data & verify ownership
            const getStoreQuery = "SELECT ownerId, logoImage FROM stores WHERE id = ?";
            const storeDataRows = await executeQuery(getStoreQuery, [storeId]); // Use executeQuery

            if (!storeDataRows || storeDataRows.length === 0) {
                return res.status(404).json({ message: "Store not found." });
            }
            const existingStore = storeDataRows[0];
            let oldImageUrlToDelete = existingStore.logoImage; // Store current logo URL

            // Verify user owns this store
            if (existingStore.ownerId !== currentUserId) {
                return res.status(403).json({ message: "You are not authorized to edit this store." });
            }

            // 2. Process uploads within cpUpload middleware
            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr instanceof multer.MulterError) {
                    console.error(`[Store] Multer error during store update for ID ${storeId}:`, uploadErr);
                    return res.status(400).json({ message: "File upload error", error: uploadErr.message });
                } else if (uploadErr) {
                    console.error(`[Store] Unexpected error during file processing middleware for store ID ${storeId}:`, uploadErr);
                    return res.status(500).json({ message: "File processing failed", error: 'Internal server error during file handling' });
                }

                let newImageUrl = null;

                // 3. Handle new image upload
                try {
                    if (req.files && req.files.logoImage && req.files.logoImage[0]) {
                        const logoFile = req.files.logoImage[0];
                        if (logoFile.size > 2 * 1024 * 1024) { // Example limit
                            return res.status(400).json({ message: "Logo image file size exceeds limit (2MB)." });
                        }
                        const imageKey = `uploads/stores/${storeId}_logo_${Date.now()}_${logoFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
                        const imageParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: imageKey,
                            Body: logoFile.buffer,
                            ContentType: logoFile.mimetype
                        };
                        console.log(`[Store] Uploading new logo for store ${storeId} with key: ${imageKey}`);
                        await s3.send(new PutObjectCommand(imageParams));
                        newImageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${imageKey}`;
                        console.log(`[Store] New logo uploaded successfully for store ${storeId}.`);
                    }
                } catch (imageUploadError) {
                    console.error(`[Store] Error processing or uploading logo image for store ${storeId}:`, imageUploadError);
                    return res.status(500).json({ message: "Failed to process or upload logo image", error: imageUploadError.message || "Internal server error" });
                }

                // 4. Dynamically Build Update Query
                const updateFieldsPayload = {};
                const values = [];
                const setClauses = [];

                const allowedTextFields = {
                    label: 'label',
                    description: 'description',
                    category: 'category',
                    web_link: 'web_link',
                };

                for (const key in allowedTextFields) {
                    // Only include field if it exists in the request body
                    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                        const dbColumn = allowedTextFields[key];
                        setClauses.push(`${dbColumn} = ?`);
                        values.push(req.body[key]);
                        updateFieldsPayload[dbColumn] = req.body[key];
                    }
                }

                // Add new image URL if it was uploaded
                if (newImageUrl) {
                    setClauses.push(`logoImage = ?`);
                    values.push(newImageUrl);
                    updateFieldsPayload.logoImage = newImageUrl;
                }

                // 5. Execute DB Update (only if there are changes)
                if (setClauses.length > 0) {
                    values.push(storeId); // Add store ID for the WHERE clause
                    const sqlQuery = `UPDATE stores SET ${setClauses.join(', ')} WHERE id = ?`;

                    try {
                        console.log(`[Store] Executing DB update for store ID: ${storeId}.`);
                        const result = await executeQuery(sqlQuery, values);

                        if (result.affectedRows > 0) {
                            console.log(`[Store] Store updated successfully in DB for ID: ${storeId}`);

                            // --- Delete Old S3 Object (after successful DB update) ---
                            if (newImageUrl && oldImageUrlToDelete) {
                                console.log(`[Store] Attempting to delete old logo image for store ${storeId}: ${oldImageUrlToDelete}`);
                                await deleteS3Object(oldImageUrlToDelete); // Use helper
                            }

                            res.status(200).json({
                                message: "Store details updated successfully",
                                updatedFields: updateFieldsPayload,
                            });

                        } else {
                            // Query executed, but no rows changed (maybe data was identical)
                            console.warn(`[Store] No rows updated for store ID: ${storeId}. Data might be identical.`);
                             res.status(200).json({
                                message: "Store details processed. No changes needed or applied.",
                                updatedFields: updateFieldsPayload
                             });
                        }

                    } catch (dbError) {
                        console.error(`[Store] Database error updating store ${storeId}:`, dbError);
                        // --- Attempt S3 Rollback ---
                        if (newImageUrl) {
                            console.error(`[Store] Attempting S3 rollback for new logo due to DB error (store ${storeId}).`);
                            await deleteS3Object(newImageUrl); // Delete the NEW image
                        }
                        return res.status(500).json({ message: "Failed to update store details in database", error: "Database error" });
                    }
                } else {
                    // No text fields updated and no new image uploaded
                    res.status(200).json({ message: "No changes were submitted or detected for the store." });
                }
            }); // End cpUpload callback

        } catch (error) {
            // Catch errors from initial DB fetch or auth check
            console.error(`[Store] Unexpected error in editStoreDetails handler for store ID ${storeId}:`, error);
            if (!res.headersSent) {
                res.status(500).json({ message: "Failed to edit store details due to an unexpected server error", error: "Internal server error" });
            }
        }
    }); // End authenticateUser callback
};

//API TO DELETE STORE
export const closeStore = (req, res) => {
    authenticateUser(req, res, async () => {
        const user = req.user;
        const getStore = "SELECT logoImage FROM stores WHERE id = ? AND ownerId = ?";
        db.query(getStore, [req.params.id, user.id], async (err, data) => {
            if (err) {
                return res.status(500).json({ message: "Database query error", error: err });
            }
            if (data.length === 0) {
                return res.status(404).json({ message: "Store not found or you are not authorized to delete it." });
            }
            const logoImageUrl = data[0].logoImage;
            if (logoImageUrl) {
                const logoImageKey = s3KeyFromUrl(logoImageUrl);
                if (!logoImageKey) {
                    return res.status(400).json({ message: "Invalid S3 object URL", url: logoImageUrl });
                }
                try {
                    const deleteCommand = new DeleteObjectCommand({
                        Bucket: process.env.BUCKET_NAME,
                        Key: logoImageKey,
                    });
                    await s3.send(deleteCommand);
                    console.log("S3 object deleted successfully:", logoImageKey);
                } catch (s3Error) {
                    console.error("Error deleting S3 object:", s3Error);
                    return res.status(500).json({ message: "Error deleting logo image from S3", error: s3Error });
                }
            }
            const deleteStoreQuery = "DELETE FROM stores WHERE id = ? AND ownerId = ?";
            db.query(deleteStoreQuery, [req.params.id, user.id], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: "Database deletion error", error: err });
                }
                if (result.affectedRows > 0) {
                    return res.status(200).json({ message: "Store deleted successfully." });
                } else {
                    return res.status(403).json({ message: "You can only delete your own store." });
                }
            });
        });
    });
};



const shuffleStores = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}; 
