import sharp from 'sharp';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import {  PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import { cpUpload } from "../../middlewares/storage.js";
import { s3, s3KeyFromUrl, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import { executeQuery } from "../../middlewares/dbExecute.js";
import { redisClient, PROFILE_CACHE_TTL, ANALYTICS_CACHE_TTL } from '../../config/redisConfig.js'; 
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { processImageUrl, resizeImage } from '../../middlewares/cloudfrontConfig.js';


// export const editPassword = async (req, res) => {
//     authenticateUser(req, res, async () => {
//         try {
//             const authenticatedUser = req.user;
//             if (!authenticatedUser) {
//                 return res.status(401).send('Unauthorized. Please log in.');
//             }
//             const userId = req.user.id;
//             const { currentPassword, newPassword } = req.body; 

//             const findUserQuery = "SELECT * FROM users WHERE id = ?";
//             const [results] = await db.promise().query(findUserQuery, [userId]);
//             if (results.length === 0) {
//                 return res.status(404).send('User not found.');
//             }
//             const user = results[0];
//             const isMatch = await bcrypt.compare(currentPassword, user.password);       
//             if (!isMatch) {
//                 return res.status(400).send('Current password is incorrect.');
//             }   
//             const salt = await bcrypt.genSalt(10);
//             const hashedNewPassword = await bcrypt.hash(newPassword, salt);       
//             const updatePasswordQuery = "UPDATE users SET password = ? WHERE id = ?";
//             await db.promise().query(updatePasswordQuery, [hashedNewPassword, userId]);       
//             res.status(200).json('Password has been successfully updated.');
//         } catch (err) {
//             console.error("Error in editPassword:", err);
//             return res.status(500).send('An error occurred while updating the password.');
//         } 
//     });     
// };

// API TO EDIT USER INFO
export const editProfile = async (req, res) => {
    authenticateUser(req, res, async () => {
        const authenticatedUser = req.user;
        const userId = authenticatedUser.id;

        if (!userId) {
            return res.status(401).json({ message: "Authentication failed, user ID missing." });
        }

        try {
            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr instanceof multer.MulterError) {
                     console.error(`Multer error during profile update for user ${userId}:`, uploadErr);
                     return res.status(400).json({ message: "File upload error", error: uploadErr.message });
                 } else if (uploadErr) {
                    console.error(`Unexpected error during file processing middleware for user ${userId}:`, uploadErr);
                     return res.status(500).json({ message: "File processing failed", error: 'Internal server error during file handling' });
                 }

                let newProfilePicKey = null;
                let newCoverPhotoKey = null;
                
                const s3UploadPromises = [];
                const oldImageKeysToDelete = [];

                try {
                    // PROFILE PICTURE LOGIC
                    if (req.files && req.files.profilePic && req.files.profilePic[0]) {
                        const profilePicFile = req.files.profilePic[0];
                         if (profilePicFile.size > 5 * 1024 * 1024) { 
                            return res.status(400).json({ message: "Profile picture file size exceeds limit (5MB)." });
                         }
                        // USE IMPORTED, OPTIMIZING resizeImage FUNCTION
                        const resizedBuffer = await resizeImage(profilePicFile.buffer, 300, 300);
                        const profileKey = `uploads/profiles/${userId}_profile_${Date.now()}_${profilePicFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                        
                        const profileParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: profileKey,
                            Body: resizedBuffer,
                            ContentType: 'image/webp'
                        };
                        
                        s3UploadPromises.push(s3.send(new PutObjectCommand(profileParams)));
                        newProfilePicKey = profileKey;

                        if (authenticatedUser.profilePic && !authenticatedUser.profilePic.startsWith('http')) {
                            oldImageKeysToDelete.push(authenticatedUser.profilePic);
                        }
                    }

                    // COVER PHOTO LOGIC
                    if (req.files && req.files.coverPhoto && req.files.coverPhoto[0]) {
                        const coverPhotoFile = req.files.coverPhoto[0];
                         if (coverPhotoFile.size > 10 * 1024 * 1024) {
                            return res.status(400).json({ message: "Cover photo file size exceeds limit (10MB)." });
                         }
                        const resizedBuffer = await resizeImage(coverPhotoFile.buffer, 800, 450);
                        const coverKey = `uploads/profiles/${userId}_cover_${Date.now()}_${coverPhotoFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                        
                        const coverParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: coverKey,
                            Body: resizedBuffer,
                            ContentType: 'image/webp'
                        };
                        
                        s3UploadPromises.push(s3.send(new PutObjectCommand(coverParams)));
                        newCoverPhotoKey = coverKey;

                        if (authenticatedUser.coverPhoto && !authenticatedUser.coverPhoto.startsWith('http')) {
                            oldImageKeysToDelete.push(authenticatedUser.coverPhoto);
                        }
                    }

                    if (s3UploadPromises.length > 0) {
                         await Promise.all(s3UploadPromises);
                    }

                } catch (imageProcessingError) {
                     console.error(`Error processing or uploading images for user ${userId}:`, imageProcessingError);
                     return res.status(500).json({ message: "Failed to process or upload image(s)", error: imageProcessingError.message });
                }

                const updateFieldsPayload = {};
                const values = [];
                const setClauses = [];
                const allowedTextFields = { 
                     email: 'email', full_name: 'full_name', username: 'username',
                     nationality: 'nationality', bio: 'bio', dateOfBirth: 'dateOfBirth',
                };

                for (const key in allowedTextFields) {
                    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                        setClauses.push(`${allowedTextFields[key]} = ?`);
                        values.push(req.body[key]);
                        updateFieldsPayload[allowedTextFields[key]] = req.body[key];
                    }
                }

                if (newProfilePicKey) { setClauses.push(`profilePic = ?`); values.push(newProfilePicKey); }
                if (newCoverPhotoKey) { setClauses.push(`coverPhoto = ?`); values.push(newCoverPhotoKey); }

                if (setClauses.length > 0) {
                    values.push(userId);
                    const editQuery = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;

                    try {
                        const [result] = await db.promise().query(editQuery, values);

                        if (result.affectedRows > 0) {
                            if (newProfilePicKey) updateFieldsPayload.profilePic = processImageUrl(newProfilePicKey);
                            if (newCoverPhotoKey) updateFieldsPayload.coverPhoto = processImageUrl(newCoverPhotoKey);

                            if(oldImageKeysToDelete.length > 0){
                                await Promise.all(oldImageKeysToDelete.map(key => deleteS3Object(key)));
                            }

                            const cacheKey = `user_profile:${userId}`;
                            try {
                                await redisClient.del(cacheKey);
                            } catch (cacheError) {
                                console.error(`Redis DEL error for key ${cacheKey}:`, cacheError);
                            }
                            res.status(200).json({ message: "Account details updated successfully", updatedFields: updateFieldsPayload });
                        } else {
                            res.status(200).json({ message: "No changes needed or applied.", updatedFields: {} });
                        }
                    } catch (dbError) {
                        console.error(`Database error updating profile for user ${userId}:`, dbError);
                        if (newProfilePicKey) await deleteS3Object(newProfilePicKey);
                        if (newCoverPhotoKey) await deleteS3Object(newCoverPhotoKey);
                        return res.status(500).json({ message: "Failed to update profile in database", error: "Database error" });
                    }
                } else {
                    res.status(200).json({ message: "No profile changes were submitted." });
                }
            });
        } catch (error) {
            console.error(`Unexpected error in editProfile handler for user ${userId}:`, error);
            res.status(500).json({ message: "Failed to edit profile due to an unexpected server error" });
        }
    });
};

// API TO EDIT USER PASSWORD
export const editPassword = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!userId) {
           return res.status(401).json({ message: "Authentication failed, user ID missing." });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current password and new password are required." });
        }
        if (newPassword.length < 8) {
             return res.status(400).json({ message: "New password must be at least 8 characters long." });
        }
         if (currentPassword === newPassword) {
            return res.status(400).json({ message: "New password cannot be the same as the current password." });
        }

        try {
            const getUserQuery = "SELECT password FROM users WHERE id = ?";
            const [users] = await executeQuery(getUserQuery, [userId]);

            if (users.length === 0) {
                console.error(`User not found during password change attempt for ID: ${userId}`);
                return res.status(404).json({ message: "User not found." });
            }
            const storedPassword = users[0].password;
            const isMatch = await bcrypt.compare(currentPassword, storedPassword);
            if (!isMatch) {
                console.warn(`Incorrect current password attempt for user ID: ${userId}`);
                return res.status(401).json({ message: "Incorrect current password." });
            }

            const salt = await bcrypt.genSalt(10);
            const newHashedPassword = await bcrypt.hash(newPassword, salt);

            const updatePassword = "UPDATE users SET password = ? WHERE id = ?";
            const [updateResult] = await executeQuery(updatePassword, [newHashedPassword, userId]);

            if (updateResult.affectedRows > 0) {
                console.log(`Password updated successfully for user ID: ${userId}`);
                res.status(200).json({ message: "Password updated successfully." });
            } else {
                 console.error(`Failed to update password in DB for user ID: ${userId}, although user was found initially.`);
                 res.status(500).json({ message: "Failed to update password due to a database issue." });
            }

        } catch (error) {
            console.error(`Error changing password for user ID ${userId}:`, error);
            res.status(500).json({ message: "Failed to change password due to a server error.", error: "Internal server error" });
        }
    });
};

// FETCH AND PROCESS USER DATA (Updated with CDN Helper)
const fetchAndProcessUserData = async (userId) => {
    const q = `
        SELECT u.*,
        (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
        (SELECT COUNT(*) FROM (
            SELECT r1.followed FROM reach AS r1 WHERE r1.follower = u.id
            INTERSECT
            SELECT r2.follower FROM reach AS r2 WHERE r2.followed = u.id
        ) AS mutuals) AS followingCount,
        (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
        FROM users AS u WHERE u.id = ?`;
    
    const [data] = await db.promise().query(q, [userId]);
    if (data.length === 0) return null;

    const userInfo = data[0];
    userInfo.profilePic = processImageUrl(userInfo.profilePic);
    userInfo.coverPhoto = processImageUrl(userInfo.coverPhoto);

    return userInfo;
};

// API TO GET USER INFORMATION
export const viewProfile = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const cacheKey = `user_profile:${userId}`;
        let userInfo = userProfileCache.get(cacheKey);
        
        if (!userInfo) {
            try {
                const cachedUserInfo = await redisClient.get(cacheKey);
                if (cachedUserInfo) {
                    return res.status(200).json(JSON.parse(cachedUserInfo));
                }
                const userInfo = await fetchAndProcessUserData(userId);
                if (!userInfo) return res.status(404).json("User not found");
                
                await redisClient.setex(cacheKey, PROFILE_CACHE_TTL, JSON.stringify(userInfo));
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
    authenticateUser(req, res, async () => {
        const profileId = req.params.id; 
        const requestingUserId = req.user.id;

        if (!Number.isInteger(Number(profileId))) {
            return res.status(400).json({ message: "Invalid user ID" });
        }        
        if (Number(profileId) === requestingUserId) {
            return viewProfile(req, res);
        }

        try {
            //PERMISSION CHECKS
            const permissionQuery = `
                SELECT 
                    u.id,
                    us.profile_visibility,
                    (SELECT COUNT(*) FROM reach WHERE follower = ? AND followed = ?) as isFollowing,
                    (SELECT COUNT(*) FROM blocked_users WHERE (userId = ? AND blockedUserId = ?) OR (userId = ? AND blockedUserId = ?)) as isBlocked
                FROM users u
                LEFT JOIN user_settings us ON u.id = us.userId
                WHERE u.id = ?
            `;
            const permissionParams = [requestingUserId, profileId, requestingUserId, profileId, profileId, requestingUserId, profileId];
            const [permissionResults] = await db.promise().query(permissionQuery, permissionParams);

            if (permissionResults.length === 0) {
                return res.status(404).json({ message: "User not found." });
            }

            const permissions = permissionResults[0];

            if (permissions.isBlocked > 0) {
                return res.status(403).json({ message: "You do not have permission to view this profile." });
            }

            if (permissions.profile_visibility === 'private' && !permissions.isFollowing) {
                return res.status(403).json({ message: "This account is private. Follow them to see their profile." });
            }
            
            const recordViewQuery = "INSERT INTO profile_views (profileId, viewerId, viewedAt) VALUES (?, ?, NOW())";
            db.promise().query(recordViewQuery, [profileId, requestingUserId])
                .catch(err => {
                    console.error("Failed to record profile view:", err);
                });

            const cacheKey = `user_profile:${profileId}`;
            
            const cachedUserInfo = await redisClient.get(cacheKey);
            if (cachedUserInfo) {
                const safeUserInfo = JSON.parse(cachedUserInfo);
                delete safeUserInfo.password;
                return res.status(200).json(safeUserInfo);
            }
            const userInfo = await fetchAndProcessUserData(profileId);
            if (!userInfo) {
                userInfo = await fetchAndProcessUserData(profileId);
                if (!userInfo) return res.status(404).json({ message: "User not found" });
                
                await redisClient.setex(cacheKey, PROFILE_CACHE_TTL, JSON.stringify(userInfo));
            }

            // SANITIZE OUTPUT
            const { password, ...safeUserInfo } = userInfo;
            return res.status(200).json(safeUserInfo);

        } catch (err) {
            console.error(`Error fetching user profile for ID ${profileId}:`, err);
            return res.status(500).json({ message: "Failed to fetch user profile.", error: "DB_ERROR" });
        }
    });
};

// VIEW ALL USERS (Updated with CDN Helper)
export const viewUsers = async (req, res) => {
    try {
        const q = `SELECT id, full_name, username, profilePic, coverPhoto FROM users`;
        const [users] = await db.promise().query(q);
        
        if (!users.length) {
            return res.status(404).json({ message: "No users found" });
        }

        const processedUsers = users.map(user => {
            user.profilePic = processImageUrl(user.profilePic);
            user.coverPhoto = processImageUrl(user.coverPhoto);
            return user;
        });

        return res.status(200).json(processedUsers);
    } catch (err) {
        console.error("Failed to view users:", err);
        return res.status(500).json({ message: "Failed to view users", error: "DB_ERROR" });
    }
};

//API TO GET USER ONLINE STATUS(NOT SETUP IN DB YET)
export const getUserStatus = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        try {
            const q = "SELECT online_status, last_active FROM users WHERE id = ?";
            const [rows] = await db.promise().query(q, [userId]);
            if (rows.length === 0) {
                return res.status(404).json({ message: "User not found" });
            }
            return res.status(200).json(rows[0]);
        } catch (error) {
            console.error(`Error fetching online status for user ${userId}:`, error);
            return res.status(500).json({ message: "Failed to fetch online status", error: "DB_ERROR" });
        }
    });
}

//API TO UPDATE USER ONLINE STATUS(NOT SETUP IN DB YET)
export const updateUserStatus = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const { online_status } = req.body; // Expecting 'online' or 'offline'

        if (!['online', 'offline'].includes(online_status)) {
            return res.status(400).json({ message: "Invalid status value. Use 'online' or 'offline'." });
        }

        try {
            const q = "UPDATE users SET online_status = ?, last_active = NOW() WHERE id = ?";
            const [result] = await db.promise().query(q, [online_status, userId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User not found or status unchanged" });
            }
            return res.status(200).json({ message: "Online status updated successfully" });
        } catch (error) {
            console.error(`Error updating online status for user ${userId}:`, error);
            return res.status(500).json({ message: "Failed to update online status", error: "DB_ERROR" });
        }
    });
}

//API TO UPDATE USER AGENT DETAILS
export const updateBot = async (req, res) => {
const botId = req.params.id;
const { bio, profilePic, coverPhoto } = req.body;
code
Code
// Build the query dynamically
const fields = [];
const values = [];

if (bio) {
    fields.push("bio = ?");
    values.push(bio);
}
if (profilePic) {
    fields.push("profilePic = ?");
    values.push(profilePic);
}
if (coverPhoto) {
    fields.push("coverPhoto = ?");
    values.push(coverPhoto);
}

if (fields.length === 0) {
    return res.status(400).json({ message: "No fields to update." });
}

values.push(botId);

const q = `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND is_bot = TRUE`;

try {
    const [result] = await db.promise().query(q, values);

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Bot not found or no changes made." });
    }

    res.status(200).json({ message: "Bot updated successfully." });
} catch (error) {
    console.error("Error updating bot:", error);
    res.status(500).json({ message: "Failed to update bot." });
}
}


// API TO GET USER ANALYTICS
export const getUserAnalytics = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.params.userId;
            const cacheKey = `user_analytics:${userId}`;

            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(JSON.parse(cachedData));
            }

            if (cachedData) {
                return res.status(200).json(cachedData);
            }
            const q = `
                SELECT
                    (SELECT COUNT(*) FROM posts WHERE userId = ?) AS Total_Posts,
                    (SELECT COUNT(*) FROM reach WHERE followed = ?) AS Followers,
                    (SELECT COUNT(*) FROM reach WHERE follower = ?) AS Following,
                    (SELECT COUNT(*) FROM profile_views WHERE profileId = ?) AS Profile_Views,
                    (SELECT COUNT(*) FROM likes l JOIN posts p ON l.postId = p.id WHERE p.userId = ?) AS Post_Likes,
                    (SELECT COUNT(*) FROM comments WHERE userId = ?) AS Comments,
                    (SELECT COUNT(*) FROM post_shares ps JOIN posts p ON ps.postId = p.id WHERE p.userId = ?) AS Shares,
                    (SELECT COUNT(*) FROM bookmarked_posts bp JOIN posts p ON bp.postId = p.id WHERE p.userId = ?) AS Saves
            `;
            
            const params = [userId, userId, userId, userId, userId, userId, userId, userId];
            const [results] = await db.promise().query(q, params);

            const analytics = results[0];
            await redisClient.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(analytics));

            res.status(200).json(analytics);
        } catch (error) {
            console.error(`Error fetching user analytics for user ${req.params.userId}:`, error);
            res.status(500).json({ message: "Failed to fetch user analytics", error: error.message });
        }
    });
};


// API TO DELETE ACCOUNT
export const deleteAccount = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        try {
            const getMedia = "SELECT profilePic, coverPhoto FROM users WHERE id = ?";
            const mediaData = await executeQuery(getMedia, [userId]);
            if (!mediaData.length) {
                return res.status(404).json("User not found");
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
            await Promise.all([
                deleteImageFromS3(profilePic),
                deleteImageFromS3(coverPhoto)
            ]);

            const profileCacheKey = `user_profile:${userId}`;
            const analyticsCacheKey = `user_analytics:${userId}`;
            try {
                await redisClient.del(profileCacheKey, analyticsCacheKey);
            } catch (cacheError) {
                console.error(`Redis DEL error during account deletion for user ${userId}:`, cacheError);
            }

            //QUERY DB TO DELETE USER
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