import {db} from "../../config/connectDB.js";
import {authenticateUser} from "../../middlewares/verify.mjs";
import {cpUpload} from "../../middlewares/storage.js";
import multer from "multer";
import bcrypt from "bcryptjs";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey} from "../../middlewares/S3bucketConfig.js";

//API TO GET USER INFORMATION
export const viewProfile = (req, res)=>{
    authenticateUser(req, res, () => {
        const userId = req.user.id;
        const q = `SELECT 
                    u.*,
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM 
                    users AS u 
                    WHERE 
                    u.id = ?;`
        db.query(q, [userId], async (err, data)=>{
            if(err){
                return res.status(500).json(err)
            }
            if(data.length === 0){ 
                return res.status(404).json("User not found");
            }
            const userData = data[0];
            try {
                if (userData.coverPhoto) {
                    const coverPhotoKey = s3KeyFromUrl(userData.coverPhoto);
                    userData.coverPhoto = await generateS3Url(coverPhotoKey);
                }
                if (userData.profilePic) {
                    const profilePicKey = s3KeyFromUrl(userData.profilePic);
                    userData.profilePic = await generateS3Url(profilePicKey);
                }
            } catch (error) {
                console.error("Error generating S3 URLs:", error);
            }
            const { password, ...userInfo } = userData;
            return res.status(200).json({
                ...userInfo
            });
        })
    });
}

//API TO GET ANOTHER USER'S INFORMATION
export const viewUserProfile = (req, res)=>{
    authenticateUser(req, res, () => {
        const userId = req.params.id;
        const q = `SELECT 
                    u.*, 
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM 
                    users AS u 
                    WHERE 
                    u.id = ?;`
        db.query(q, [userId], async (err, data)=>{
            if(err){
                return res.status(500).json(err)
            }
            if(data.length === 0){ 
                return res.status(404).json("User not found");
            }
            const userData = data[0];
            try {
                if (userData.coverPhoto) {
                    const coverPhotoKey = s3KeyFromUrl(userData.coverPhoto);
                    userData.coverPhoto = await generateS3Url(coverPhotoKey);
                }
                if (userData.profilePic) {
                    const profilePicKey = s3KeyFromUrl(userData.profilePic);
                    userData.profilePic = await generateS3Url(profilePicKey);
                }
            } catch (error) {
                console.error("Error generating S3 URLs:", error);
            }
            const { password, ...userInfo } = userData;
            return res.status(200).json({
                ...userInfo,
            });
        })
    });
}
 
//API TO GET USERS
export const viewUsers = async (req, res)=>{
    authenticateUser(req, res, () => {
        //QUERY DB TO GET USERS
        const q = `SELECT 
                    u.*, 
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM 
                    users AS u`
        db.query(q, async(err, users)=>{ 
            if(err){
                return res.status(500).json(err)
            }
            if (users.length === 0) {
                return res.status(404).json("No users found");
            }
            try {
                if (userData.coverPhoto) {
                    const coverPhotoKey = s3KeyFromUrl(userData.coverPhoto);
                    userData.coverPhoto = await generateS3Url(coverPhotoKey);
                }
                if (userData.profilePic) {
                    const profilePicKey = s3KeyFromUrl(userData.profilePic);
                    userData.profilePic = await generateS3Url(profilePicKey);
                }
            } catch (error) {
                console.error("Error generating S3 URLs:", error);
                return res.status(200).json(users)
            }
        })
    });
}

export const editProfile = async (req, res) => {
    authenticateUser(req, res, () => {
      const user = req.user;
  
      cpUpload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
          return res.status(500).json({ message: "File upload error", error: err });
        } else if (err) {
          return res.status(500).json({ message: "Unknown error", error: err });
        }
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = req.body.password ? bcrypt.hashSync(req.body.password, salt) : undefined;
  
        let profilePic = null;
        if (req.files && req.files.profilePic && req.files.profilePic[0]) {
        try {
            const photo = req.files.profilePic[0];
            const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: `uploads/profiles${Date.now()}_${photo.originalname}`,
            Body: photo.buffer,
            ContentType: photo.mimetype,
            };
            const command = new PutObjectCommand(params);
            const response = await s3.send(command);
            profilePic = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
        } catch (uploadError) {
            console.error("Error uploading profile picture to S3:", uploadError);
            return res.status(500).json({
            message: "Error uploading profile picture to S3",
            error: uploadError,
            });
        }
        }

        let coverPhoto = null;
        if (req.files && req.files.coverPhoto && req.files.coverPhoto[0]) {
        try {
            const photo = req.files.coverPhoto[0];
            const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: `uploads/profiles${Date.now()}_${photo.originalname}`,
            Body: photo.buffer,
            ContentType: photo.mimetype,
            };
            const command = new PutObjectCommand(params);
            const response = await s3.send(command);
            coverPhoto = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
        } catch (uploadError) {
            console.error("Error uploading cover photo to S3:", uploadError);
            return res.status(500).json({
            message: "Error uploading cover photo to S3",
            error: uploadError,
            });
        }
        }
  
        const q = `
          UPDATE users 
          SET email = ?, full_name = ?, username = ?, nationality = ?, password = ?, coverPhoto = ?, profilePic = ?, bio = ? 
          WHERE id = ?
        `;
        const values = [
          req.body.email,
          req.body.fullName,
          req.body.username,
          req.body.nationality,
          hashedPassword || user.password,
          profilePic,
          coverPhoto,
          req.body.bio,
          user.id,
        ];
        db.query(q, values, (err, data) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Database error", error: err });
          }
          res.status(200).json({ message: "Account updated successfully", values, data });
        });
      }); 
    });
};

//API TO DELETE ACCOUNT 
export const deleteAccount = (req, res)=>{ 
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO EDIT USER INFO
        const q = "DELETE FROM users WHERE id = ?"
        db.query(q, user.id, (err, data)=>{ 
            if(err){  
                return res.status(500).json(err)
            }
            if(data.length === 0){
                return res.status(404).json("User not found");
            }
            res.clearCookie("accessToken",{
                secure: true,
                sameSite: "none"
            })
            return res.status(200).json(`Account has been deleted successfully`)
        })  
    }) 
}
