import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import { processImageUrl, resizeImage } from '../../middlewares/cloudfrontConfig.js';

// API TO ADD NEW CATALOGUE ITEM
export const addCatalogueItem = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err) return res.status(400).json({ message: "File upload error", error: err.message });
            
            const ownerId = req.user.id;
            const storeId = req.params.id;
            const { product_name, product_description, price, delivery_time, purchase_link } = req.body;
            
            if (!Number.isInteger(Number(storeId))) {
                return res.status(400).json({ message: "Invalid store ID" });
            }

            try {
                const [storeData] = await db.promise().query("SELECT id FROM stores WHERE id = ? AND ownerId = ?", [storeId, ownerId]);
                if (storeData.length === 0) {
                    return res.status(403).json({ message: "Not authorized to add to this store." });
                }

                if (!req.files || !req.files.productImage || !req.files.productImage[0]) {
                   return res.status(400).json({ message: "A product image is required." });
                }

                const photo = req.files.productImage[0];
                const resizedBuffer = await resizeImage(photo.buffer, 500, 500);
                const key = `uploads/stores/items/${Date.now()}_${photo.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;

                const params = { Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' };
                await s3.send(new PutObjectCommand(params));
                const productImageKey = key;

                const insertQuery = `
                    INSERT INTO catalogue_items (storeId, product_image, product_name, product_description, price, delivery_time, purchase_link, created)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                `;
                const values = [
                    storeId, productImageKey, product_name, product_description,
                    price, delivery_time, purchase_link, moment().format("YYYY-MM-DD HH:mm:ss")
                ];

                const [result] = await db.promise().query(insertQuery, values);
                return res.status(200).json({ message: "Catalogue item added successfully", itemId: result.insertId });

            } catch (error) {
                console.error("Error adding catalogue item:", error);
                return res.status(500).json({ message: "Failed to add catalogue item.", error: error.message });
            }
        });
    });
};

// API TO GET CATALOGUE ITEMS FOR A STORE
export const getCatalogueItems = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const storeId = req.params.storeId;
            if (!Number.isInteger(Number(storeId))) {
                return res.status(400).json({ message: "Invalid store ID" });
            }
    
            const q = `SELECT * FROM catalogue_items WHERE storeId = ? ORDER BY created DESC`;
            const [items] = await db.promise().query(q, [storeId]);
    
            const processedItems = items.map(item => {
                if (item.product_image) {
                    item.product_image = processImageUrl(item.product_image);
                }
                return item;
            });
            
            res.status(200).json(processedItems);
        } catch (error) {
            console.error("Error fetching catalogue items:", error);
            res.status(500).json({ message: "Failed to fetch catalogue items.", error: error.message });
        }
    });
};

//GET SINGLE CATALOGUE ITEM
export const getCatalogueItemById = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const itemId = req.params.id;

            if (!Number.isInteger(Number(itemId))) {
                return res.status(400).json({ message: "Invalid catalogue item ID." });
            }

            const q = `
                SELECT
                    ci.*,
                    s.label AS storeLabel,
                    s.logoImage AS storeLogo,
                    u.id AS ownerId,
                    u.username AS ownerUsername
                FROM
                    catalogue_items AS ci
                JOIN
                    stores AS s ON ci.storeId = s.id
                JOIN
                    users AS u ON s.ownerId = u.id
                WHERE
                    ci.id = ?;
            `;

            const [data] = await db.promise().query(q, [itemId]);

            if (data.length === 0) {
                return res.status(404).json({ message: "Catalogue item not found." });
            }

            const item = data[0];

            // PROCESS IMAGES
            item.product_image = processImageUrl(item.product_image);
            item.storeLogo = processImageUrl(item.storeLogo);

            res.status(200).json(item);

        } catch (error) {
            console.error(`Error fetching catalogue item by ID:`, error);
            res.status(500).json({ message: "Failed to fetch catalogue item.", error: error.message });
        }
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
            const [itemDataRows] = await db.promise().query("SELECT storeId, product_image FROM catalogue_items WHERE id = ?", [itemId]);
            if (itemDataRows.length === 0) return res.status(404).json({ message: "Catalogue item not found." });
            
            const existingItem = itemDataRows[0];
            const [storeDataRows] = await db.promise().query("SELECT ownerId FROM stores WHERE id = ?", [existingItem.storeId]);
            if (storeDataRows.length === 0) return res.status(404).json({ message: "Associated store not found." });
            if (storeDataRows[0].ownerId !== currentUserId) {
                return res.status(403).json({ message: "You are not authorized to edit this item." });
            }

            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr) return res.status(400).json({ message: "File upload error", error: uploadErr.message });
                
                let newImageKey = null;
                try {
                    if (req.files && req.files.productImage && req.files.productImage[0]) {
                        const productImageFile = req.files.productImage[0];
                        const resizedBuffer = await resizeImage(productImageFile.buffer, 500, 500);
                        const key = `uploads/stores/items/${existingItem.storeId}_item_${itemId}_${Date.now()}_${productImageFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                        
                        await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' }));
                        newImageKey = key;
                    }
                } catch (imageUploadError) {
                    return res.status(500).json({ message: "Failed to upload product image", error: imageUploadError.message });
                }

                const updateFieldsPayload = {};
                const values = [];
                const setClauses = [];
                const allowedTextFields = { product_name: 'product_name', product_description: 'product_description', price: 'price', delivery_time: 'delivery_time', purchase_link: 'purchase_link' };

                for (const key in allowedTextFields) {
                    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                        setClauses.push(`${allowedTextFields[key]} = ?`);
                        values.push(req.body[key]);
                        updateFieldsPayload[allowedTextFields[key]] = req.body[key];
                    }
                }

                if (newImageKey) {
                    setClauses.push(`product_image = ?`);
                    values.push(newImageKey);
                }

                if (setClauses.length === 0) {
                    return res.status(200).json({ message: "No changes were submitted for the item." });
                }
                
                values.push(itemId);
                const sqlQuery = `UPDATE catalogue_items SET ${setClauses.join(', ')} WHERE id = ?`;

                try {
                    const [result] = await db.promise().query(sqlQuery, values);
                    if (result.affectedRows > 0) {
                        if (newImageKey) {
                            updateFieldsPayload.product_image = processImageUrl(newImageKey);
                            if (existingItem.product_image) await deleteS3Object(existingItem.product_image);
                        }
                        res.status(200).json({ message: "Catalogue item updated successfully", updatedFields: updateFieldsPayload });
                    } else {
                        res.status(200).json({ message: "No changes needed or applied.", updatedFields: updateFieldsPayload });
                    }
                } catch (dbError) {
                    if (newImageKey) await deleteS3Object(newImageKey);
                    return res.status(500).json({ message: "Failed to update item in database", error: "Database error" });
                }
            });
        } catch (error) {
            console.error(`Unexpected error in editCatalogueItem handler for item ID ${itemId}:`, error);
            res.status(500).json({ message: "Failed to edit catalogue item.", error: "Internal server error" });
        }
    });
};

// API TO DELETE A CATALOGUE ITEM
export const deleteCatalogueItem = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const itemId = req.params.id;

            const [itemData] = await db.promise().query("SELECT storeId, product_image FROM catalogue_items WHERE id = ?", [itemId]);
            if (itemData.length === 0) return res.status(404).json({ message: "Catalogue item not found." });
            
            const item = itemData[0];

            const [storeData] = await db.promise().query("SELECT ownerId FROM stores WHERE id = ?", [item.storeId]);
            if (storeData.length === 0) return res.status(404).json({ message: "Associated store not found." });
            if (storeData[0].ownerId !== userId) return res.status(403).json({ message: "You are not authorized to delete this item." });

            if (item.product_image) {
                await deleteS3Object(item.product_image);
            }

            await db.promise().query("DELETE FROM catalogue_items WHERE id = ?", [itemId]);
            return res.status(200).json({ message: "Catalogue item deleted successfully." });

        } catch (error) {
            console.error("Error deleting catalogue item:", error);
            return res.status(500).json({ message: "Failed to delete catalogue item", error: error.message });
        }
    });
};