import {db} from "../../config/connectDB.js";
import {authenticateUser} from "../../middlewares/verify.mjs";
import {cpUpload} from "../../middlewares/storage.js";
import multer from "multer";
import bcrypt from "bcryptjs";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey} from "../../middlewares/S3bucketConfig.js";


//API TO EDIT USER INFO
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
            let profilePic = { url: null, key: null };
            if (req.files && req.files.profilePic && req.files.profilePic[0]) {
                try {
                    const photo = req.files.profilePic[0];
                    const key = `uploads/profiles/${Date.now()}_${photo.originalname}`;
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: key,
                        Body: photo.buffer,
                        ContentType: photo.mimetype,
                    };
                    const command = new PutObjectCommand(params);
                    await s3.send(command);
                    profilePic = {
                        url: `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${key}`,
                    };
                } catch (uploadError) {
                    console.error("Error uploading profile picture to S3:", uploadError);
                    return res.status(500).json({
                        message: "Error uploading profile picture to S3",
                        error: uploadError,
                    });
                }
            }
            let coverPhoto = { url: null, key: null };
            if (req.files && req.files.coverPhoto && req.files.coverPhoto[0]) {
                try {
                    const photo = req.files.coverPhoto[0];
                    const key = `uploads/profiles/${Date.now()}_${photo.originalname}`;
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: key,
                        Body: photo.buffer,
                        ContentType: photo.mimetype,
                    };
                    const command = new PutObjectCommand(params);
                    await s3.send(command);
                    coverPhoto = {
                        url: `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${key}`,
                    };
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
                coverPhoto.url,
                profilePic.url,
                req.body.bio,
                user.id,
            ];

            db.query(q, values, (err, data) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ message: "Database error", error: err });
                }

                res.status(200).json({
                    message: "Account updated successfully",
                    profilePic,
                    coverPhoto,
                    values,
                    data,
                });
            });
        });
    });
};

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
 
export const viewUsers = async (req, res) => {
    authenticateUser(req, res, () => {
        // QUERY DB TO GET USERS
        const q = `SELECT 
                    u.*, 
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM 
                    users AS u`;

        db.query(q, async (err, users) => {
            if (err) {
                return res.status(500).json({ message: "Database error", error: err });
            }

            if (users.length === 0) {
                return res.status(404).json({ message: "No users found" });
            }

            try {
                const allUsers = await Promise.all(
                    users.map(async (userData) => {
                        if (userData.coverPhoto) {
                            const coverPhotoKey = s3KeyFromUrl(userData.coverPhoto);
                            userData.coverPhoto = await generateS3Url(coverPhotoKey);
                        }
                        if (userData.profilePic) {
                            const profilePicKey = s3KeyFromUrl(userData.profilePic);
                            userData.profilePic = await generateS3Url(profilePicKey);
                        }
                        return userData;
                    })
                );
                return res.status(200).json(allUsers);
            } catch (error) {
                console.error("Error generating S3 URLs:", error);
                return res.status(500).json({ message: "Error processing user data", error });
            }
        });
    });
};


//API TO DELETE ACCOUNT 
export const deleteAccount = async (req, res) => {
    authenticateUser(req, res, async () => {
        const user = req.user;
        const getMedia = "SELECT profilePic, coverPhoto FROM users WHERE id = ?";
        db.query(getMedia, [user.id], async (getError, result) => {
            if (getError) {
                return res.status(500).json({ message: "Database error", error: getError });
            }
            if (result.length === 0) {
                return res.status(404).json("User not found");
            }
            const { profilePic, coverPhoto } = result[0];
            const deleteImageFromS3 = async (imageUrl) => {
                if (imageUrl) {
                    try {
                        const key = imageUrl.split(`https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/`)[1];
                        const params = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: key,
                        };
                        const command = new DeleteObjectCommand(params);
                        await s3.send(command);
                    } catch (s3Error) {
                        console.error("Error deleting image from S3:", s3Error);
                        return res.status(500).json({ message: "Error deleting image from S3", error: s3Error });
                    }
                }
            };
            await deleteImageFromS3(profilePic);
            await deleteImageFromS3(coverPhoto);
            const deleteQuery = "DELETE FROM users WHERE id = ?";
            db.query(deleteQuery, [user.id], (deleteErr, data) => {
                if (deleteErr) {
                    return res.status(500).json({ message: "Database error", error: deleteErr });
                }
                res.clearCookie("accessToken", {
                    secure: true,
                    sameSite: "none",
                });
                return res.status(200).json("Account has been deleted successfully");
            });
        });
    });
};
