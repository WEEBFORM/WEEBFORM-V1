import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";
// import WeebAI from "../../AI AGENT/WeebAIClass.js";
import NodeCache from 'node-cache';

const postCache = new NodeCache({ stdTTL: 300 }); 
// const weebAI = new WeebAI(process.env.GEMINI_API_KEY);

const shufflePosts = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// API TO CREATE NEW POST
export const newPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr instanceof multer.MulterError) {
                    return res.status(400).json({ message: "File upload error", error: uploadErr.message });
                } else if (uploadErr) {
                    console.error("Unexpected error during upload:", uploadErr);
                    return res.status(500).json({ message: "File upload failed", error: "Unexpected error" });
                }

                const userId = req.user.id;
                const { description, tags, category } = req.body;
                const media = req.files && req.files["media"] ? req.files["media"] : [];
                const uploadedMediaUrls = [];

                // try {
                //     console.log("AI moderation check starting...");
                //     console.log("WeebAI intents:", weebAI.intents);
                //     console.log("Delete content intent:", weebAI.intents?.delete_content);
                    
                //     if (!weebAI.intents?.delete_content || !weebAI.intents.delete_content.checkContent) {
                //         throw new Error("AI moderation function is not properly initialized.");
                //     }
                    
                //     const shouldDelete = await weebAI.intents.delete_content.checkContent(description);
                //     if (shouldDelete) {
                //         return res.status(400).json({ message: "Post violates community guidelines and was deleted." });
                //     }
                // } catch (error) {
                //     console.error("AI moderation error:", error);
                //     return res.status(500).json({ message: "AI moderation failed.", error: error.message });
                // }

                for (const file of media) {
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: `uploads/posts/${Date.now()}_${file.originalname}`,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                    };
                    await s3.send(new PutObjectCommand(params));
                    uploadedMediaUrls.push(`https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${params.Key}`);
                }
                const query = "INSERT INTO posts (userId, description, tags, category, media, createdAt) VALUES (?, ?, ?, ?, ?, ?)";
                const values = [userId, description, tags, category, JSON.stringify(uploadedMediaUrls), moment().format("YYYY-MM-DD HH:mm:ss")];
                await db.execute(query, values);

                return res.status(201).json({ message: "Post created successfully." });
            });
        } catch (error) {
            console.error("Error creating post:", error);
            return res.status(500).json({ message: "Server error.", error: error.message });
        }
    });
};


// HELPER FUNCTION TO FETCH POSTS
const fetchPostsData = async (q, params) => {
    try {
        const [rows] = await db.promise().query(q, params);
        return rows;
    } catch (error) {
        console.error("Error fetching posts:", error);
        throw new Error("DB_ERROR"); // More specific error code
    }
};

// API TO GET ALL POSTS, FOLLOWING POSTS, AND USER POSTS (Consolidated)
const getPosts = async (req, res, queryType) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const searchTerm = req.query.searchTerm || '';
        const searchValue = `%${searchTerm}%`;
        let q;
        let params = [userId, userId, searchValue, searchValue, searchValue]; // Default params

        switch (queryType) {
            case 'all':
                q = `SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                    COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                    CASE WHEN l2.userId = ? THEN TRUE ELSE FALSE END AS liked
                    FROM posts AS p JOIN users AS u ON u.id = p.userId
                    LEFT JOIN likes AS l ON l.postId = p.id LEFT JOIN comments AS c ON c.postId = p.id
                    LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                    WHERE (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                break;
            case 'following':   
                q = `SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                    COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                    CASE WHEN l2.userId = ? THEN TRUE ELSE FALSE END AS liked
                    FROM posts AS p JOIN users AS u ON u.id = p.userId
                    LEFT JOIN likes AS l ON l.postId = p.id LEFT JOIN comments AS c ON c.postId = p.id
                    LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                    LEFT JOIN reach AS r ON (p.userId = r.followed)
                    WHERE (r.follower = ? OR p.userId = ?)
                    AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                params = [userId,userId, userId, userId, searchValue, searchValue, searchValue];
                break; 
            case 'user':   
                 q = `SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                    COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                    CASE WHEN l2.userId = ? THEN TRUE ELSE FALSE END AS liked
                    FROM posts AS p JOIN users AS u ON u.id = p.userId
                    LEFT JOIN likes AS l ON l.postId = p.id LEFT JOIN comments AS c ON c.postId = p.id
                    LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                    WHERE u.id = ? AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                params = [userId, userId, req.params.id, searchValue, searchValue, searchValue];
                break;
            default:
                return res.status(400).json({ message: "Invalid query type" });
        }

        try {
            let cacheKey = `posts:${queryType}:${userId}:${searchTerm}`;  // Construct a cache key that includes everything
            let cachedPosts = postCache.get(cacheKey);  // Try to retrieve from cache
            let posts;

            if (cachedPosts) {
                posts = cachedPosts;  // Serve from cache
                console.log("Serving posts from cache", cacheKey);
            } else {
            let data = await fetchPostsData(q, params);
             posts = await Promise.all(
                data.map(async (post) => {
                    if (post.media) {
                        const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                        try {
                            post.media = await Promise.all(mediaKeys.map(generateS3Url));
                        } catch (mediaErr) {
                            console.warn("Failed to generate all media URLs:", mediaErr);
                            post.media = null;
                        }
                    }
                     if (post.profilePic) {
                        post.profilePic = await generateS3Url(s3KeyFromUrl(post.profilePic));
                    }
                    return post;
                })
            );
               if (queryType !=="user"){
                     postCache.set(cacheKey, posts);
                }
            }
            res.status(200).json(posts);
        } catch (error) {
            console.error("Error in getPosts:", error);
            res.status(500).json({ message: "Failed to fetch posts", error });
        }
    });
}; 

export const allPosts = (req, res) => getPosts(req, res, 'all');
export const followingPosts = (req, res) => getPosts(req, res, 'following');
export const userPosts = (req, res) => getPosts(req, res, 'user');

// API TO VIEW POST BASED ON CATEGORY
export const postCategory = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const { category } = req.params;
        const searchTerm = req.query.searchTerm || '';
        const searchValue = `%${searchTerm}%`;

        try {
            const q = `SELECT p.*, u.id AS userId, u.username, full_name, u.profilePic,
                      COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                      CASE WHEN l2.userId = ? THEN TRUE ELSE FALSE END AS liked
                    FROM posts AS p JOIN users AS u ON u.id = p.userId 
                    LEFT JOIN likes AS l ON l.postId = p.id
                     LEFT JOIN comments AS c ON c.postId = p.id
                     LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                    WHERE p.category = ? AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id 
                    ORDER BY createdAt DESC`;
            const [data] = await db.promise().query(q, [userId, userId, category, searchValue, searchValue, searchValue]);

            if (data.length === 0) {
                return res.status(404).json("No posts found in this category.");
            }
            const posts = await Promise.all(
                data.map(async (post) => {
                    if (post.media) {
                        const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                        try {
                            post.media = await Promise.all(mediaKeys.map(generateS3Url));
                        } catch (mediaErr) {
                            console.warn("Failed to generate all media URLs:", mediaErr);
                            post.media = null;
                        }
                    }
                     if (post.profilePic) {
                        post.profilePic = await generateS3Url(s3KeyFromUrl(post.profilePic));
                    }
                    return post;
                })
            );

            res.status(200).json(posts);
        } catch (err) {
            console.error("Error fetching posts by category:", err);
            res.status(500).json({ message: "Failed to fetch posts", error: err });
        }
    });
};

// API TO GET A SINGLE POST BY ID
export const getPostById = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = req.params.id;

        try {
            const q = `
                SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                CASE WHEN l2.userId = ? THEN TRUE ELSE FALSE END AS liked
                FROM posts AS p
                JOIN users AS u ON u.id = p.userId
                LEFT JOIN likes AS l ON l.postId = p.id
                LEFT JOIN comments AS c ON c.postId = p.id
                LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                WHERE p.id = ?
                GROUP BY p.id, u.id
            `;

            const [data] = await db.promise().query(q, [userId, userId, postId]);

            if (data.length === 0) {
                return res.status(404).json({ message: "Post not found" });
            }

            const post = data[0];
            if (post.media) {
                const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                try {
                    post.media = await Promise.all(mediaKeys.map(generateS3Url));
                } catch (mediaErr) {
                    console.warn("Failed to generate all media URLs:", mediaErr);
                    post.media = null;
                }
            }
             if (post.profilePic) {
                post.profilePic = await generateS3Url(s3KeyFromUrl(post.profilePic));
            }

            res.status(200).json(post);
        } catch (error) {
            console.error("Error fetching post by ID:", error);
            res.status(500).json({ message: "Failed to fetch post", error });
        }
    });
};
 
// API TO DELETE POST
export const deletePost = async (req, res) => {
    authenticateUser(req, res, async () => {  
        const userId = req.user.id;
        const postId = req.params.id;
        try {
            const getPost = "SELECT media AS mediaUrl FROM posts WHERE id = ? AND userId = ?";
            const [data] = await db.promise().query(getPost, [postId, userId]);

            if (!data.length) {
                return res.status(404).json({ message: "Post not found!" });
            }

            const { mediaUrl } = data[0];
            const mediaUrls = mediaUrl ? mediaUrl.split(",") : [];

            await Promise.all(mediaUrls.map(async (url) => {
                const key = s3KeyFromUrl(url);
                if (key) {
                    const deleteParams = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: key,
                    };
                    try {
                        await s3.send(new DeleteObjectCommand(deleteParams));
                        console.log("Deleted S3 object:", key);
                    } catch (s3Error) {
                        console.error("S3 deletion error for key:", key, s3Error);
                    }
                } else {
                    console.warn("Invalid S3 URL, skipping deletion:", url);
                }
            }));

            const deletePostQuery = "DELETE FROM posts WHERE id = ? AND userId = ?";
            const [result] = await db.promise().query(deletePostQuery, [postId, userId]);

            if (result.affectedRows > 0) {
                 postCache.flushAll()

                return res.status(200).json({ message: "Post deleted successfully." });
            } else {
                return res.status(403).json({ message: "You can only delete your own post." });
            }
        } catch (err) {
            console.error("Failed to delete post:", err);
            return res.status(500).json({ message: "Failed to delete post", error: err });
        }
    });
};
