import { db } from "../../../config/connectDB.js";
import { authenticateUser } from "../../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../../middlewares/storage.js";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../../middlewares/S3bucketConfig.js";
import { processImageUrl, resizeImage } from '../../../middlewares/cloudfrontConfig.js';

// CREATE NEW POST for Community Feed
export const newCommunityPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        cpUpload(req, res, async (err) => {
            if (err) return res.status(400).json({ message: "File upload error", error: err.message });
            
            try {
                const userId = req.user.id;
                const communityId = req.params.id;

                const [membership] = await db.promise().query("SELECT COUNT(*) AS isMember FROM community_members WHERE userId = ? AND communityId = ?", [userId, communityId]);
                if (membership[0].isMember === 0) {
                    return res.status(403).json({ message: "You must be a member of this community to post." });
                }

                const mediaFiles = req.files && req.files["media"] ? req.files["media"] : [];
                let uploadedMediaKeys = [];

                for (const file of mediaFiles) {
                    const resizedBuffer = await resizeImage(file.buffer, 1080, 1080);
                    const key = `uploads/posts/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                    await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' }));
                    uploadedMediaKeys.push(key);
                }

                const mediaString = uploadedMediaKeys.join(",");
                const values = [userId, communityId, req.body.description, mediaString, req.body.category, moment().format("YYYY-MM-DD HH:mm:ss")];
                const [post] = await db.promise().query("INSERT INTO communityposts (`userId`, `communityId`, `description`, `media`, `category`, `createdAt`) VALUES (?)", [values]);
                
                res.status(200).json({ message: "Post created successfully", postId: post.insertId });

            } catch (error) {
                console.error("Error creating community post:", error);
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
                post.media = post.media ? post.media.split(',').map(key => processImageUrl(key.trim())) : [];
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
    
            const mediaKeys = data[0].media ? data[0].media.split(',') : [];
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