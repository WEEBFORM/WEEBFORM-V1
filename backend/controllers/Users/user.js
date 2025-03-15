import sharp from 'sharp';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import { cpUpload } from "../../middlewares/storage.js";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";
import { executeQuery } from "../../middlewares/dbExecute.js";
import NodeCache from 'node-cache';
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const userProfileCache = new NodeCache({ stdTTL: 600 }); // Cache user data for 10 minutes

const resizeImage = async (buffer, width, height) => {
    return await sharp(buffer).resize(width, height).toBuffer();
};

// API TO EDIT USER INFO
export const editProfile = async (req, res) => {
    authenticateUser(req, res, async () => { // Ensure async for proper error handling
        const user = req.user;
        try {
            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr instanceof multer.MulterError) {
                    return res.status(400).json({ message: "File upload error", error: uploadErr.message }); // Improved error message
                } else if (uploadErr) {
                    console.error("Unexpected error during upload:", uploadErr);
                    return res.status(500).json({ message: "File upload failed", error: 'Unexpected error' });
                }

                let profilePicUrl = user.profilePic;
                let coverPhotoUrl = user.coverPhoto;

                if (req.files) {
                    if (req.files.profilePic && req.files.profilePic[0]) {
                        const profilePic = req.files.profilePic[0];
                        const resizedBuffer = await resizeImage(profilePic.buffer, 300, 300);
                        const profileKey = `uploads/profiles/${Date.now()}_${profilePic.originalname}`;
                        const profileParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: profileKey,
                            Body: resizedBuffer,
                            ContentType: profilePic.mimetype,
                        };
                        await s3.send(new PutObjectCommand(profileParams));
                        profilePicUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${profileKey}`;

                    }
                    if (req.files.coverPhoto && req.files.coverPhoto[0]) {
                        const coverPhoto = req.files.coverPhoto[0];
                        const resizedBuffer = await resizeImage(coverPhoto.buffer, 800, 450);
                        const coverKey = `uploads/profiles/${Date.now()}_${coverPhoto.originalname}`;
                        const coverParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: coverKey,
                            Body: resizedBuffer,
                            ContentType: coverPhoto.mimetype,
                        };
                        await s3.send(new PutObjectCommand(coverParams));
                        coverPhotoUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${coverKey}`;

                    }
                }

                const values = [
                    req.body.email,
                    req.body.full_name,
                    req.body.username,
                    req.body.nationality,
                    coverPhotoUrl || user.coverPhoto, 
                    profilePicUrl || user.profilePic,
                    req.body.bio,
                    user.id,
                ];

                await executeQuery(
                    `UPDATE users SET email = ?, full_name = ?, username = ?, nationality = ?, coverPhoto = ?, profilePic = ?, bio = ? WHERE id = ?`,
                    values
                );

                // Clear cache for updated user
                userProfileCache.del(user.id); // Remove single user cache, other view might use it too

                res.status(200).json({
                    message: "Account updated successfully",
                    profilePicUrl,
                    coverPhotoUrl,
                    // Omit sensitive data like hashed password
                });

            });
        } catch (error) {
            console.error("Unexpected error in editProfile:", error);
            res.status(500).json({ message: "Failed to edit profile", error: "Unexpected error" });
        }
    });
};

// Function to fetch and process user data
const fetchAndProcessUserData = async (userId) => {
    const q = `SELECT
                    u.*,
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM
                    users AS u
                    WHERE
                    u.id = ?`;
    const data = await executeQuery(q, [userId]);
    if (!data.length) {
        return null; // User not found
    }
    const userInfo = data[0];

    // Generate S3 URLs
    if (userInfo.coverPhoto) {
        const coverPhotoKey = s3KeyFromUrl(userInfo.coverPhoto);
        userInfo.coverPhoto = await generateS3Url(coverPhotoKey);
    }
    if (userInfo.profilePic) {
        const profilePicKey = s3KeyFromUrl(userInfo.profilePic);
        userInfo.profilePic = await generateS3Url(profilePicKey);
    }

    return userInfo;
};

// API TO GET USER INFORMATION
export const viewProfile = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        // Check cache
        let userInfo = userProfileCache.get(userId);
        if (!userInfo) {
            try {
                userInfo = await fetchAndProcessUserData(userId);
                if (!userInfo) {
                    return res.status(404).json("User not found");
                }
                userProfileCache.set(userId, userInfo);
            } catch (err) {
                console.error("Database error:", err);
                return res.status(500).json({ message: "Failed to fetch user profile.", error: "DB_ERROR" });
            }
        }

        return res.status(200).json(userInfo);
    });
}; 
  
// API TO GET ANOTHER USER'S INFORMATION
export const viewUserProfile = async (req, res) => {
    const userId = req.params.id;
    if (!Number.isInteger(Number(userId))) {
        return res.status(400).json({ message: "Invalid userId" });
    }

    // Check cache
    let userInfo = userProfileCache.get(userId);
    if (!userInfo) {
        try {
            userInfo = await fetchAndProcessUserData(userId);
            if (!userInfo) {
                return res.status(404).json("User not found");
            }
            userProfileCache.set(userId, userInfo);
        } catch (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Failed to fetch user profile.", error: "DB_ERROR" });
        }
    }

    const { password, ...safeUserInfo } = userInfo;
    return res.status(200).json(safeUserInfo);
};

export const viewUsers = async (req, res) => {
    try {
        const q = `SELECT
                    u.*,
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM
                    users AS u`;
        const users = await executeQuery(q);
        if (!users.length) {
            return res.status(404).json({ message: "No users found" });
        }

        // Process users to get S3 URLs
        const processedUsers = await Promise.all(users.map(async (user) => {
            if (user.profilePic) {
                const profilePicKey = s3KeyFromUrl(user.profilePic);
                user.profilePic = await generateS3Url(profilePicKey);
            }
             if (user.coverPhoto) {
                const coverPhotoKey = s3KeyFromUrl(user.coverPhoto);
                user.coverPhoto = await generateS3Url(coverPhotoKey);
            }
            const { password, ...safeUser } = user; // Ensure password is not exposed
            return safeUser;
        }));

        return res.status(200).json(processedUsers);
    } catch (err) {
        console.error("Failed to view users:", err);
        return res.status(500).json({ message: "Failed to view users", error: "DB_ERROR" });
    }
};

// API TO DELETE ACCOUNT
export const deleteAccount = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id; // User ID for better readability
        try {
            const getMedia = "SELECT profilePic, coverPhoto FROM users WHERE id = ?";
            const mediaData = await executeQuery(getMedia, [userId]);
            if (!mediaData.length) {
                return res.status(404).json("User not found"); // Inform that user could not be found
            }
            const { profilePic, coverPhoto } = mediaData[0];

            const deleteImageFromS3 = async (imageUrl) => {
                if (imageUrl) {
                    const key = s3KeyFromUrl(imageUrl);
                    if (!key) {
                        console.warn("Invalid S3 URL, skipping deletion:", imageUrl);
                        return;
                    }
                    const deleteParams = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: key,
                    };
                    await s3.send(new DeleteObjectCommand(deleteParams));
                }
            };

            // Delete images concurrently for improved speed
            await Promise.all([
                deleteImageFromS3(profilePic),
                deleteImageFromS3(coverPhoto)
            ]);

            // Finally, delete user from DB
            await executeQuery("DELETE FROM users WHERE id = ?", [userId]);
            userProfileCache.del(userId)

            res.clearCookie("accessToken", {
                secure: true,
                sameSite: "none",
            });
            return res.status(200).json("Account has been deleted successfully");
        } catch (error) {
            console.error("Failed to delete account:", error);
            return res.status(500).json({ message: "Failed to delete account", error });
        }
    });
};