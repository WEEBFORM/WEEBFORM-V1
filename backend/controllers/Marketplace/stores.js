import {db} from "../../config/connectDB.js"
import errorHandler from "../../middlewares/Transformer.js";
import {authenticateUser} from "../../middlewares/verify.mjs"
import moment from "moment"
import multer from "multer";
import {cpUpload} from "../../middlewares/storage.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";
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

//API TO EDIT STORE INFO/DATA
export const editStoreDetails = async (req, res) => {
    authenticateUser(req, res, () => {
        const ownerId = req.user.id;
        //QUERY DB TO EDIT USER INFO
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            } 
            const storeId = req.params.id

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
                    await s3.send(command);
                    logoImage = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
                } catch (uploadError) {
                    console.error("Error uploading file:", uploadError);
                    return res.status(500).json({ message: "Error uploading file to S3", error: uploadError });
                }
            }
            const q = "UPDATE stores SET label = ?, description = ?, logoImage = ?, category = ? WHERE id = ? AND ownerId = ?"
            const values = [
                req.body.label,
                req.body.description,
                logoImage,
                req.body.category,
                storeId,
                ownerId
            ];
            db.query(q, values, (err, store) => {
                if (err) {
                    return res.status(500).json(err)
                }
                if (!ownerId) {
                    res.status(403).json("Can't edit, not your store")
                }
                if (store.length === 0) {
                    return res.status(404).json("Store not found!");
                }
                else {
                    res.status(200).json({ message: `${req.body.label} Merch store  updated successfully!`, values })
                }
            })
        })

    })
}

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
