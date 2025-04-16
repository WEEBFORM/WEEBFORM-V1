import {db} from "../../config/connectDB.js"
import errorHandler from "../../middlewares/Transformer.js";
import {authenticateUser} from "../../middlewares/verify.mjs"
import moment from "moment"
import multer from "multer";
import {cpUpload} from "../../middlewares/storage.js";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";

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
export const editCatalogueItem = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }

            const itemId = req.params.id;
            const { product_name, product_description, price, delivery_time, purchase_link } = req.body;

            const itemQuery = "SELECT * FROM catalogue_items WHERE id = ?";
            db.query(itemQuery, [itemId], async (err, items) => {
                if (err) return res.status(500).json({ message: "Database error", error: err });
                if (items.length === 0) {
                    return res.status(404).json({ message: "Catalogue item not found" });
                }
                const item = items[0];

                const storeQuery = "SELECT * FROM stores WHERE id = ? AND ownerId = ?";
                db.query(storeQuery, [item.storeId, req.user.id], async (err, storeData) => {
                    if (err) return res.status(500).json({ message: "Database error", error: err });
                    if (storeData.length === 0) {
                        return res.status(403).json({ message: "Not authorized to edit this catalogue item" });
                    }

                    let productImageUrl = item.product_image;
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
                            console.error("Error uploading new catalogue image:", uploadError);
                            return res.status(500).json({ message: "Error uploading new product image", error: uploadError });
                        }
                    }

                    const updateQuery = `
                        UPDATE catalogue_items
                        SET product_image = ?, product_name = ?, product_description = ?, price = ?, delivery_time = ?, purchase_link = ?
                        WHERE id = ?
                    `;
                    const values = [
                        productImageUrl,
                        product_name || item.product_name,
                        product_description || item.product_description,
                        price || item.price,
                        delivery_time || item.delivery_time,
                        purchase_link || item.purchase_link,
                        itemId
                    ];
                    db.query(updateQuery, values, (err, result) => {
                        if (err) return res.status(500).json({ message: "Error updating catalogue item", error: err });
                        return res.status(200).json({ message: "Catalogue item updated successfully" });
                    });
                });
            });
        });
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
