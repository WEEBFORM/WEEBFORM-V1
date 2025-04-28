import {db} from "../../config/connectDB.js"
import { executeQuery } from "../../middlewares/dbExecute.js";
import {authenticateUser} from "../../middlewares/verify.mjs"
import moment from "moment"
import multer from "multer";
import {cpUpload} from "../../middlewares/storage.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl, deleteS3Object } from "../../middlewares/S3bucketConfig.js";

// API TO ADD NEW CATALOGUE ITEM
export const addCatalogueItem = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            const ownerId = req.user.id;
            const storeId = req.params.id;
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }

            const { product_name, product_description, price, delivery_time, purchase_link } = req.body;
            if (!Number.isInteger(Number(storeId))) {
                return res.status(400).json({ message: "Invalid store ID" });
            }

            const storeQuery = "SELECT * FROM stores WHERE id = ? AND ownerId = ?";
            db.query(storeQuery, [storeId, ownerId], async (err, storeData) => {
                if (err) return res.status(500).json({ message: "Database error", error: err });
                if (storeData.length === 0) {
                    return res.status(403).json({ message: "Not authorized to add catalogue item to this store" });
                }

                let productImageUrl = null;
                if (req.files && req.files.productImage && req.files.productImage[0]) {
                    try {
                        const photo = req.files.productImage[0];
                        const params = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: `uploads/stores/${Date.now()}_${photo.originalname}`,
                            Body: photo.buffer,
                            ContentType: photo.mimetype,
                        };
                        const command = new PutObjectCommand(params);
                        await s3.send(command);
                        productImageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
                    } catch (uploadError) {
                        console.error("Error uploading catalogue image:", uploadError); 
                        return res.status(500).json({ message: "Error uploading product image to S3", error: uploadError });
                    }
                }
                else{
                   return res.status(400).json({ message: "Missing catalogue image"});
                }

                const insertQuery = `
                    INSERT INTO catalogue_items
                    (storeId, product_image, product_name, product_description, price, delivery_time, purchase_link, created)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const values = [
                    storeId,
                    productImageUrl,
                    product_name,
                    product_description,
                    price,
                    delivery_time,
                    purchase_link,
                    moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
                ];

                db.query(insertQuery, values, (err, result) => {
                    if (err) return res.status(500).json({ message: "Error adding catalogue item", error: err });
                    return res.status(200).json({ message: "Catalogue item added successfully", itemId: result.insertId });
                });
            });
        });
    });
};

// API TO GET CATALOGUE ITEMS FOR A STORE
export const getCatalogueItems = (req, res) => {
    authenticateUser(req, res, () => {
        const storeId = req.params.storeId;
        if (!Number.isInteger(Number(storeId))) {
            return res.status(400).json({ message: "Invalid store ID" });
        }

        const q = `SELECT * FROM catalogue_items WHERE storeId = ? ORDER BY created DESC`;
        db.query(q, [storeId], async (err, data) => {
            if (err) return res.status(500).json({ message: "Error fetching catalogue items", error: err });

            const processedItems = await Promise.all(data.map(async (item) => {
                if (item.product_image) {
                    const imageKey = s3KeyFromUrl(item.product_image);
                    try {
                        item.product_image = await generateS3Url(imageKey);
                    } catch (error) {
                        console.error("Error generating product image URL:", error);
                        item.product_image = null;
                    }
                }
                return item;
            }));
            res.status(200).json(processedItems);
        });
    });
};

// API TO EDIT CATALOGUE ITEM
export const editCatalogueItem = async (req, res) => {
    authenticateUser(req, res, async () => {
        const currentUserId = req.user.id;
        const itemId = req.params.id;

        if (!itemId || isNaN(Number(itemId))) {
            return res.status(400).json({ message: "Invalid or missing catalogue item ID." });
        }
        try {
            const getItemQuery = "SELECT storeId, product_image FROM catalogue_items WHERE id = ?";
            const itemDataRows = await executeQuery(getItemQuery, [itemId]);
            if (!itemDataRows || itemDataRows.length === 0) {
                return res.status(404).json({ message: "Catalogue item not found." });
            }
            const existingItem = itemDataRows[0];
            const storeId = existingItem.storeId;

            let oldImageUrlToDelete = existingItem.product_image;
            
            const storeQuery = "SELECT ownerId FROM stores WHERE id = ?";
            const storeDataRows = await executeQuery(storeQuery, [storeId]);

            if (!storeDataRows || storeDataRows.length === 0) {
                console.error(`[Catalogue] Associated store with ID ${storeId} not found for item ${itemId}`);
                return res.status(404).json({ message: "Associated store not found." });
            }
            if (storeDataRows[0].ownerId !== currentUserId) {
                return res.status(403).json({ message: "You are not authorized to edit this catalogue item." });
            }

            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr instanceof multer.MulterError) {
                    console.error(`[Catalogue] Multer error during item update for ID ${itemId}:`, uploadErr);
                    return res.status(400).json({ message: "File upload error", error: uploadErr.message });
                } else if (uploadErr) {
                    console.error(`[Catalogue] Unexpected error during file processing middleware for item ID ${itemId}:`, uploadErr);
                    return res.status(500).json({ message: "File processing failed", error: 'Internal server error during file handling' });
                }

                let newImageUrl = null;
                try {
                    if (req.files && req.files.productImage && req.files.productImage[0]) {
                        const productImageFile = req.files.productImage[0];
                        if (productImageFile.size > 5 * 1024 * 1024) { // Example limit
                            return res.status(400).json({ message: "Product image file size exceeds limit (5MB)." });
                        }
                        const imageKey = `uploads/stores/${storeId}_item_${itemId}_${Date.now()}_${productImageFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
                        const imageParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: imageKey,
                            Body: productImageFile.buffer,
                            ContentType: productImageFile.mimetype
                        };
                        console.log(`[Catalogue] Uploading new image for item ${itemId} with key: ${imageKey}`);
                        await s3.send(new PutObjectCommand(imageParams));
                        newImageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${imageKey}`;
                        console.log(`[Catalogue] New image uploaded successfully for item ${itemId}.`);
                    }
                } catch (imageUploadError) {
                    console.error(`[Catalogue] Error processing or uploading image for item ${itemId}:`, imageUploadError);
                    return res.status(500).json({ message: "Failed to process or upload product image", error: imageUploadError.message || "Internal server error" });
                }
                const updateFieldsPayload = {};
                const values = [];
                const setClauses = [];

                const allowedTextFields = {
                    product_name: 'product_name',
                    product_description: 'product_description',
                    price: 'price',
                    delivery_time: 'delivery_time',
                    purchase_link: 'purchase_link',
                };

                for (const key in allowedTextFields) {
                    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                        const dbColumn = allowedTextFields[key];
                        setClauses.push(`${dbColumn} = ?`);
                        values.push(req.body[key]);
                        updateFieldsPayload[dbColumn] = req.body[key];
                    }
                }

                if (newImageUrl) {
                    setClauses.push(`product_image = ?`);
                    values.push(newImageUrl);
                    updateFieldsPayload.product_image = newImageUrl;
                }

                if (setClauses.length > 0) {
                    values.push(itemId);
                    const sqlQuery = `UPDATE catalogue_items SET ${setClauses.join(', ')} WHERE id = ?`;

                    try {
                        console.log(`[Catalogue] Executing DB update for item ID: ${itemId}.`);
                        const result = await executeQuery(sqlQuery, values);

                        if (result.affectedRows > 0) {
                            console.log(`[Catalogue] Item updated successfully in DB for ID: ${itemId}`);
                            if (newImageUrl && oldImageUrlToDelete) {
                                console.log(`[Catalogue] Attempting to delete old image for item ${itemId}: ${oldImageUrlToDelete}`);
                                await deleteS3Object(oldImageUrlToDelete);
                            }

                            res.status(200).json({
                                message: "Catalogue item updated successfully",
                                updatedFields: updateFieldsPayload,
                            });

                        } else {
                             console.warn(`[Catalogue] No rows updated for item ID: ${itemId}. Data might be identical.`);
                             res.status(200).json({
                                message: "Catalogue item processed. No changes needed or applied.",
                                updatedFields: updateFieldsPayload
                             });
                        }

                    } catch (dbError) {
                        console.error(`[Catalogue] Database error updating item ${itemId}:`, dbError);
                        // --- Attempt S3 Rollback ---
                        if (newImageUrl) {
                            console.error(`[Catalogue] Attempting S3 rollback for new image due to DB error (item ${itemId}).`);
                            await deleteS3Object(newImageUrl); // Delete the NEW image
                        }
                        return res.status(500).json({ message: "Failed to update catalogue item in database", error: "Database error" });
                    }
                } else {
                    res.status(200).json({ message: "No changes were submitted or detected for the catalogue item." });
                }
            });
        } catch (error) {
            console.error(`[Catalogue] Unexpected error in editCatalogueItem handler for item ID ${itemId}:`, error);
            if (!res.headersSent) {
                res.status(500).json({ message: "Failed to edit catalogue item due to an unexpected server error", error: "Internal server error" });
            }
        }
    });
};

// API TO DELETE A CATALOGUE ITEM
export const deleteCatalogueItem = (req, res) => {
    authenticateUser(req, res, async () => {
        const user = req.user;
        const itemId = req.params.id;

        try {
            const getItemQuery = "SELECT storeId, product_image FROM catalogue_items WHERE id = ?";  
            db.query(getItemQuery, [itemId], async (err, itemData) => {
                if (err) {
                    return res.status(500).json({ message: "Database query error", error: err });
                }
 
                if (itemData.length === 0) {
                    return res.status(404).json({ message: "Catalogue item not found." });
                }

                const item = itemData[0];

                const storeQuery = "SELECT ownerId FROM stores WHERE id = ?";
                db.query(storeQuery, [item.storeId], async (err, storeData) => {
                    if (err) {
                        return res.status(500).json({ message: "Database query error", error: err });
                    }

                    if (storeData.length === 0) {
                        return res.status(404).json({ message: "Store not found." });
                    }

                    if (storeData[0].ownerId !== user.id) {
                        return res.status(403).json({ message: "You are not authorized to delete this catalogue item." });
                    }
                    if (item.product_image) {
                        const productImageKey = s3KeyFromUrl(item.product_image);
                        if (productImageKey) {
                            try {
                                const deleteCommand = new DeleteObjectCommand({
                                    Bucket: process.env.BUCKET_NAME,
                                    Key: productImageKey,
                                });
                                await s3.send(deleteCommand);
                                console.log("S3 object deleted successfully:", productImageKey);
                            } catch (s3Error) {
                                console.error("Error deleting S3 object:", s3Error);
                                return res.status(500).json({ message: "Error deleting product image from S3", error: s3Error });
                            }
                        } else {
                            console.warn("Invalid S3 URL, skipping deletion:", item.product_image);
                        }
                    }
                    const deleteItemQuery = "DELETE FROM catalogue_items WHERE id = ?";
                    db.query(deleteItemQuery, [itemId], (err, result) => {
                        if (err) {
                            return res.status(500).json({ message: "Database deletion error", error: err });
                        }

                        if (result.affectedRows > 0) {
                            return res.status(200).json({ message: "Catalogue item deleted successfully." });
                        } else {
                            return res.status(404).json({ message: "Catalogue item not found." });
                        }
                    });
                });
            });
        } catch (error) {
            console.error("Error deleting catalogue item:", error);
            return res.status(500).json({ message: "Failed to delete catalogue item", error: error });
        }
    });
};
