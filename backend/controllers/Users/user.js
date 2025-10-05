import sharp from 'sharp';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import { cpUpload } from "../../middlewares/storage.js";
import { s3, generateS3Url, s3KeyFromUrl, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import { executeQuery } from "../../middlewares/dbExecute.js";
import NodeCache from 'node-cache';
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const userProfileCache = new NodeCache({ stdTTL: 600 }); 
const resizeImage = async (buffer, width, height) => {
    try {
        return await sharp(buffer).resize(width, height).toBuffer();
    } catch (error) {
        console.error("Error resizing image:", error);
        throw new Error("Failed to resize image");
    }
};

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

                // These will store the S3 KEY for the database
                let newProfilePicKey = null;
                let newCoverPhotoKey = null;
                
                const s3UploadPromises = [];
                const oldImageUrlsToDelete = [];

                try {
                    // --- PROFILE PICTURE LOGIC ---
                    if (req.files && req.files.profilePic && req.files.profilePic[0]) {
                        const profilePicFile = req.files.profilePic[0];
                         if (profilePicFile.size > 5 * 1024 * 1024) { 
                            return res.status(400).json({ message: "Profile picture file size exceeds limit (5MB)." });
                         }
                        const resizedBuffer = await resizeImage(profilePicFile.buffer, 300, 300);
                        const profileKey = `uploads/profiles/${userId}_profile_${Date.now()}_${profilePicFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
                        
                        const profileParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: profileKey,
                            Body: resizedBuffer,
                            ContentType: profilePicFile.mimetype
                        };
                        
                        s3UploadPromises.push(s3.send(new PutObjectCommand(profileParams)));
                        newProfilePicKey = profileKey; // Store the KEY for the database

                        if (authenticatedUser.profilePic && !authenticatedUser.profilePic.startsWith('http')) {
                            oldImageUrlsToDelete.push(authenticatedUser.profilePic);
                        }
                    }

                    // --- COVER PHOTO LOGIC ---
                    if (req.files && req.files.coverPhoto && req.files.coverPhoto[0]) {
                        const coverPhotoFile = req.files.coverPhoto[0];
                         if (coverPhotoFile.size > 10 * 1024 * 1024) {
                            return res.status(400).json({ message: "Cover photo file size exceeds limit (10MB)." });
                         }
                        const resizedBuffer = await resizeImage(coverPhotoFile.buffer, 800, 450);
                        const coverKey = `uploads/profiles/${userId}_cover_${Date.now()}_${coverPhotoFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
                        
                        const coverParams = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: coverKey,
                            Body: resizedBuffer,
                            ContentType: coverPhotoFile.mimetype
                        };
                        
                        s3UploadPromises.push(s3.send(new PutObjectCommand(coverParams)));
                        newCoverPhotoKey = coverKey; // Store the KEY for the database

                        if (authenticatedUser.coverPhoto && !authenticatedUser.coverPhoto.startsWith('http')) {
                            oldImageUrlsToDelete.push(authenticatedUser.coverPhoto);
                        }
                    }

                    if (s3UploadPromises.length > 0) {
                         console.log(`Uploading ${s3UploadPromises.length} file(s) to S3 for user ${userId}...`);
                         await Promise.all(s3UploadPromises);
                         console.log(`S3 uploads completed successfully for user ${userId}.`);
                    }

                } catch (imageProcessingError) {
                     console.error(`Error processing or uploading images for user ${userId}:`, imageProcessingError);
                     return res.status(500).json({ message: "Failed to process or upload image(s)", error: imageProcessingError.message || "Internal server error" });
                }

                // --- DYNAMICALLY BUILD UPDATE QUERY ---
                const updateFieldsPayload = {};
                const values = [];
                const setClauses = [];
                const allowedTextFields = { 
                     email: 'email',
                     full_name: 'full_name',
                     username: 'username',
                     nationality: 'nationality',
                     bio: 'bio',
                     dateOfBirth: 'dateOfBirth',
                 };

                for (const key in allowedTextFields) {
                    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                        const dbColumn = allowedTextFields[key];
                        setClauses.push(`${dbColumn} = ?`);
                        values.push(req.body[key]);
                        updateFieldsPayload[dbColumn] = req.body[key]; // Keep text fields in payload
                    }
                }

                if (newProfilePicKey) {
                    setClauses.push(`profilePic = ?`);
                    values.push(newProfilePicKey); // Push the KEY to the DB values
                }
                if (newCoverPhotoKey) {
                    setClauses.push(`coverPhoto = ?`);
                    values.push(newCoverPhotoKey); // Push the KEY to the DB values
                }

                if (setClauses.length > 0) {
                    values.push(userId);
                    const editQuery = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;

                    try {
                        const result = await db.promise().query(editQuery, values); // Use db.promise() for async/await

                        if (result[0].affectedRows > 0) {
                            console.log(`User profile updated successfully in DB for user ID: ${userId}`);

                            // Generate full URLs for the response payload AFTER successful DB update
                            if (newProfilePicKey) {
                                updateFieldsPayload.profilePic = await generateS3Url(newProfilePicKey);
                            }
                            if (newCoverPhotoKey) {
                                updateFieldsPayload.coverPhoto = await generateS3Url(newCoverPhotoKey);
                            }

                            // Delete OLD images from S3
                            if(oldImageUrlsToDelete.length > 0){
                                console.log(`Attempting to delete ${oldImageUrlsToDelete.length} old S3 objects for user ${userId}.`);
                                // Assuming deleteS3Object is designed to take a full URL or just a key
                                await Promise.all(oldImageUrlsToDelete.map(keyOrUrl => deleteS3Object(keyOrUrl)));
                                console.log(`Finished attempting old S3 object deletion for user ${userId}.`);
                            }

                            userProfileCache.del(String(userId));
                            console.log(`Cache cleared for user ID: ${userId}`);

                             res.status(200).json({
                                message: "Account details updated successfully",
                                updatedFields: updateFieldsPayload,
                            });

                        } else {
                             console.warn(`No rows updated for user ID: ${userId}. User might not exist or data was identical.`);
                             res.status(200).json({
                                message: "Account details processed. No changes needed or applied.",
                                updatedFields: {}
                             });
                        }

                    } catch (dbError) {
                        console.error(`Database error updating profile for user ${userId}:`, dbError);
                        
                        // S3 ROLLBACK: Delete newly uploaded images if DB update fails
                        console.error(`Attempting S3 rollback due to DB error for user ${userId}.`);
                        if (newProfilePicKey) await deleteS3Object(newProfilePicKey);
                        if (newCoverPhotoKey) await deleteS3Object(newCoverPhotoKey);
                        
                        return res.status(500).json({ message: "Failed to update profile in database", error: "Database error" });
                    }
                } else {
                    res.status(200).json({ message: "No profile changes were submitted or detected." });
                }
            });
        } catch (error) {
            console.error(`Unexpected error in editProfile handler for user ${userId}:`, error);
            res.status(500).json({ message: "Failed to edit profile due to an unexpected server error", error: "Internal server error" });
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
                //Invalidate any sessions/tokens associated with this user here - "To Be Implemented"
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

// FETCH AND PROCESS USER DATA
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
        return null;
    }
    const userInfo = data[0];

    // GENERATE S3 URLs
    if (userInfo.coverPhoto) {
        if(userInfo.coverPhoto.startsWith('http')) {// Already a full URL, likely from a third-party OAuth provider}
        }
        else {
            const coverPhotoKey = s3KeyFromUrl(userInfo.coverPhoto);
            userInfo.coverPhoto = await generateS3Url(coverPhotoKey);
        }
    }
    if (userInfo.profilePic) {
        if (userInfo.profilePic.startsWith('http')) {} else {
            const profilePicKey = s3KeyFromUrl(userInfo.profilePic);
            userInfo.profilePic = await generateS3Url(profilePicKey);
        }

    }

    return userInfo;
};

// API TO GET USER INFORMATION
export const viewProfile = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

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
    authenticateUser(req, res, async () => {
        const profileId = req.params.id;
        const requestingUserId = req.user.id;

        if (!Number.isInteger(Number(profileId))) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        // USER IS REQUESTING THEIR OWN PROFILE
        if (Number(profileId) === requestingUserId) {
            try {
                const selfInfo = await fetchAndProcessUserData(requestingUserId);
                if (!selfInfo) return res.status(404).json("User not found");
                return res.status(200).json(selfInfo);
            } catch (err) {
                 return res.status(500).json({ message: "Failed to fetch your profile.", error: "DB_ERROR" });
            }
        }
        
        try {
            // PERMISSION CHECKS
            const settingsQuery = "SELECT profile_visibility FROM user_settings WHERE userId = ?";
            const blockQuery = "SELECT COUNT(*) AS count FROM blocked_users WHERE (userId = ? AND blockedUserId = ?) OR (userId = ? AND blockedUserId = ?)";
            const followQuery = "SELECT COUNT(*) AS count FROM reach WHERE follower = ? AND followed = ?";

            const [
                [settingsRows],
                [blockRows],
                [followRows]
            ] = await Promise.all([
                db.promise().query(settingsQuery, [profileId]),
                db.promise().query(blockQuery, [requestingUserId, profileId, profileId, requestingUserId]),
                db.promise().query(followQuery, [requestingUserId, profileId])
            ]);

            // CHECK BLOCK STATUS
            const isBlocked = blockRows[0].count > 0;
            if (isBlocked) {
                // Return 404 to hide the fact that a block is the reason for privacy
                return res.status(403).json({ message: "Restricted access" });
            }

            // cCHECK PROFILE VISIBILITY
            const visibility = settingsRows.length > 0 ? settingsRows[0].profile_visibility : 'public';
            
            if (visibility === 'private') {
                const isFollower = followRows[0].count > 0;
                if (!isFollower) {
                    return res.status(403).json({
                        message: "This account is private. Follow this user to see their profile.",
                        isPrivate: true
                    });
                }
            }

            // IF PASSES ALL CHECKS, FETCH PROFILE
            let userInfo = userProfileCache.get(profileId);
            if (!userInfo) {
                userInfo = await fetchAndProcessUserData(profileId);
                if (!userInfo) {
                    return res.status(404).json("User not found");
                }
                userProfileCache.set(profileId, userInfo);
            }

            const { password, ...safeUserInfo } = userInfo;
            return res.status(200).json(safeUserInfo);

        } catch (err) {
            console.error(`Error fetching user profile for ID ${profileId}:`, err);
            return res.status(500).json({ message: "Failed to fetch user profile due to a server error.", error: "DB_ERROR" });
        }
    });
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

        const processedUsers = await Promise.all(users.map(async (user) => {
            if (user.profilePic) {
                if (user.profilePic.startsWith('http')) {
                } else {
                    const profilePicKey = s3KeyFromUrl(user.profilePic);
                    user.profilePic = await generateS3Url(profilePicKey);
                }
            }
             if (user.coverPhoto) {
                if(user.coverPhoto.startsWith('http')) {
                }   else { 
                    const coverPhotoKey = s3KeyFromUrl(user.coverPhoto);
                    user.coverPhoto = await generateS3Url(coverPhotoKey);
                }
            }
            const { password, ...safeUser } = user;
            return safeUser;
        }));

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