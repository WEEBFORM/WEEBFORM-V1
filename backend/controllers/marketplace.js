import {db} from "../config/connectDB.js"
import errorHandler from "../middlewares/Transformer.js";
import {authenticateUser} from "../middlewares/verify.mjs"
import moment from "moment"
import multer from "multer";
import {cpUpload} from "../middlewares/storage.js";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey} from "../middlewares/S3bucketConfig.js";

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
            const checkQuery = "SELECT * FROM stores WHERE ownerId = ?";
            db.query(checkQuery, [user.id], async (err, data) => {
                if (err) { 
                    return res.status(500).json({ message: "Database query error", error: err });
                } 
                if (data.length) {
                    return res.status(409).json({ message: "You can only create one store" });
                }
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
            });
        });
    });
};
 
//API TO VIEW ALL STORES
export const viewStores = async (req, res) => {
    authenticateUser(req, res, () => {
      const q = `
        SELECT 
          s.*, 
          u.username AS ownerUsername, 
          u.profilePic AS ownerProfilePic
        FROM 
          stores AS s
        JOIN 
          users AS u ON u.id = s.ownerId
      `;
  
      db.query(q, async (err, data) => {
        if (err) return res.status(500).json(err);
  
        const processedStores = await Promise.all(
          data.map(async (store) => {
            console.log("Processing store:", store);
  
            if (store.logoImage) {
              const imageKey = s3KeyFromUrl(store.logoImage);
              console.log("Extracted image key:", imageKey);
  
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
  
            return store;
          })
        );
  
        res.status(200).json(processedStores);
      });
    });
  };

//API TO VIEW A SINGLE STORE
export const viewSingleStore = async(req, res)=>{
authenticateUser(req, res, async()=>{
    const storeId = req.params.id;
    const q = `
    SELECT
        s.*,
        u.username AS ownerUsername,
        u.profilePic AS ownerProfilePic
    FROM 
        stores AS s 
    JOIN
        users AS u ON u.id = s.ownerId
    WHERE s.id = ?
    `;

    db.query(q, [storeId] , async(err, data) => {
    if (err) return res.status(500).json(err);

        if(data.length === 0){
            return res.status(404).json({message: 'Store not found'});
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
        res.status(200).json(store);

    })
})
}
  
//API TO EDIT STORE INFO/DATA
export const editStoreDetails = async(req, res)=>{
    authenticateUser(req, res, () => {
        const ownerId = req.user.id;
        //QUERY DB TO EDIT USER INFO
        cpUpload(req, res, async (err)=>{
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }
            const storeId = req.params.id
            
            let logoImage = null;
            if (req.files && req.files.logoImage && req.files.logoImage[0]) {
                try {
                    const photo = req.files.logoImage[0]; // Only the first file in the array
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
            db.query(q, values, (err, store)=>{
            if(err){
               return res.status(500).json(err)
            }
            if (!ownerId){
                res.status(403).json("Can't edit, not your store")
            }
            if (store.length === 0) {
                return res.status(404).json("Store not found!");
            }
            else{
                res.status(200).json({message:`${req.body.label} Merch store  updated successfully!`, values})
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
