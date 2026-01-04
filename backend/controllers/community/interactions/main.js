import { db } from "../../../config/connectDB.js";
import { authenticateUser } from "../../../middlewares/verify.mjs";
import moment from "moment";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../../middlewares/S3bucketConfig.js";
import { processImageUrl, resizeImage, resizeImageForReels } from '../../../middlewares/cloudfrontConfig.js';
import fs from 'fs';
import path from 'path';

const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const communityPostStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    }
});

const uploadCommunityPostMedia = multer({
    storage: communityPostStorage,
    limits: {
        fileSize: 1024 * 1024 * 500, // 500 MB limit to allow videos
        fieldSize: 1024 * 1024 * 55,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
        }
    }
}).fields([
    { name: 'media', maxCount: 4 }
]);

// CREATE NEW POST for Community Feed
export const newCommunityPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        uploadCommunityPostMedia(req, res, async (err) => {
            if (err) return res.status(400).json({ message: "File upload error", error: err.message });
            
            try {
                const userId = req.user.id;
                const communityId = req.params.id;

                // VERIFY MEMBERSHIP
                const [membership] = await db.promise().query("SELECT COUNT(*) AS isMember FROM community_members WHERE userId = ? AND communityId = ?", [userId, communityId]);
                if (membership[0].isMember === 0) {
                    if (req.files?.media) {
                        req.files.media.forEach(file => {
                            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                        });
                    }
                    return res.status(403).json({ message: "You must be a member of this community to post." });
                }

                // PROCESS MEDIA
                const mediaFiles = req.files && req.files["media"] ? req.files["media"] : [];
                let uploadedMediaKeys = [];

                for (const file of mediaFiles) {
                    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
                    let fileBuffer;
                    let contentType;
                    let key;

                    // HANDLE IMAGE AND VIDEO DIFFERENTLY
                    if (file.mimetype.startsWith('image/')) {
                        fileBuffer = await resizeImageForReels(file.path, 1080, 1080);
                        contentType = 'image/webp';
                        key = `uploads/posts/${Date.now()}_${sanitizedFilename}.webp`;
                    } else if (file.mimetype.startsWith('video/')) {
                        fileBuffer = fs.createReadStream(file.path);
                        contentType = file.mimetype;
                        key = `uploads/posts/${Date.now()}_${sanitizedFilename}`;
                    } else {
                        continue;
                    }

                    await s3.send(new PutObjectCommand({ 
                        Bucket: process.env.BUCKET_NAME, 
                        Key: key, 
                        Body: fileBuffer, 
                        ContentType: contentType 
                    }));
                    
                    uploadedMediaKeys.push(key);

                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                }

                // SAVE POST TO DATABASE
                const mediaString = uploadedMediaKeys.length > 0 ? JSON.stringify(uploadedMediaKeys) : null;
                
                const values = [userId, communityId, req.body.description, mediaString, req.body.category, moment().format("YYYY-MM-DD HH:mm:ss")];
                const [post] = await db.promise().query("INSERT INTO communityposts (`userId`, `communityId`, `description`, `media`, `category`, `createdAt`) VALUES (?)", [values]);
                
                res.status(200).json({ message: "Post created successfully", postId: post.insertId });

            } catch (error) {
                console.error("Error creating community post:", error);
                
                if (req.files?.media) {
                    req.files.media.forEach(file => {
                        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    });
                }

                return res.status(500).json({ message: "Failed to create post.", error: error.message });
            }
        });
    });
};

// API TO VIEW COMMUNITY POSTS
export const fetchCommunityPosts = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const communityId = req.params.id;
            if (!communityId) return res.status(400).json({ message: "Community ID is required." });

            const q = `
                SELECT cp.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                       (SELECT COUNT(*) FROM likes WHERE communityPostId = cp.id) AS likesCount
                FROM communityposts AS cp
                JOIN users AS u ON u.id = cp.userId
                WHERE cp.communityId = ?
                GROUP BY cp.id
                ORDER BY cp.createdAt DESC;
            `;

            const [posts] = await db.promise().query(q, [communityId]);
            
            const processedPosts = posts.map(post => {
                let mediaArray = [];
                
                if (post.media) {
                    if (Array.isArray(post.media)) {
                        mediaArray = post.media.map(k => processImageUrl(k));
                    } else if (typeof post.media === 'string') {
                        try {
                            const parsed = JSON.parse(post.media);
                            if (Array.isArray(parsed)) {
                                mediaArray = parsed.map(key => processImageUrl(key.trim()));
                            } else {
                                mediaArray = post.media.split(',').map(key => processImageUrl(key.trim()));
                            }
                        } catch (e) {
                            mediaArray = post.media.split(',')
                                .map(key => key.trim())
                                .filter(key => key)
                                .map(key => processImageUrl(key));
                        }
                    }
                }
                
                post.media = mediaArray.length > 0 ? mediaArray : null;
                post.profilePic = processImageUrl(post.profilePic);
                return post;
            });

            res.status(200).json(processedPosts);
        } catch (error) {
            console.error("Error fetching community posts:", error);
            return res.status(500).json({ message: "Database error", error: error.message });
        }
    });
};

// API TO DELETE COMMUNITY POST
export const deleteCommunityPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;
    
            const [data] = await db.promise().query("SELECT media FROM communityposts WHERE id = ? AND userId = ?", [postId, userId]);
            if (data.length === 0) {
                return res.status(404).json({ message: "Post not found or you are not authorized to delete it!" });
            }
            let mediaKeys = [];
            if (data[0].media) {
                try {
                    const parsed = JSON.parse(data[0].media);
                    if (Array.isArray(parsed)) {
                        mediaKeys = parsed;
                    } else {
                        mediaKeys = data[0].media.split(',');
                    }
                } catch (e) {
                    mediaKeys = data[0].media.split(',');
                }
            }

            if (mediaKeys.length > 0) {
                await Promise.all(mediaKeys.map(key => deleteS3Object(key.trim())));
            }
            
            await db.promise().query("DELETE FROM communityposts WHERE id = ? AND userId = ?", [postId, userId]);
            return res.status(200).json({ message: "Post deleted successfully." });

        } catch (error) {
            console.error("Error deleting community post:", error);
            return res.status(500).json({ message: "Failed to delete post", error: error.message });
        }
    });
};

// SHUUFLE POSTS
const shufflePosts = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};