import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import NodeCache from 'node-cache';
import { processImageUrl, resizeImage } from '../../middlewares/cloudfrontConfig.js';

const postCache = new NodeCache({ stdTTL: 300 });

const processPosts = (posts) => {
    if (!posts || posts.length === 0) return [];
    
    return posts.map(post => {
        if (post.media) {
            post.media = post.media.split(',').map(keyOrUrl => processImageUrl(keyOrUrl.trim()));
        } else {
            post.media = [];
        }
        
        if (post.profilePic) {
            post.profilePic = processImageUrl(post.profilePic);
        }
        return post;
    });
};

export const newPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr) return res.status(400).json({ message: "File upload error", error: uploadErr.message });

                const userId = req.user.id;
                const { description, tags, category } = req.body;
                const mediaFiles = req.files && req.files["media"] ? req.files["media"] : [];
                let uploadedMediaKeys = [];

                for (const file of mediaFiles) {
                    try {
                        const resizedBuffer = await resizeImage(file.buffer, 1080, 1080);
                        const key = `uploads/posts/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                        
                        const params = { Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' };
                        await s3.send(new PutObjectCommand(params));
                        uploadedMediaKeys.push(key);
                    } catch (s3Error) {
                        console.error("Error uploading to S3:", s3Error);
                        return res.status(500).json({ message: "Error uploading one or more files to S3", error: s3Error.message });
                    }
                }

                const mediaString = uploadedMediaKeys.join(',');
                const query = "INSERT INTO posts (userId, description, tags, category, media, createdAt) VALUES (?, ?, ?, ?, ?, ?)";
                const values = [userId, description, tags, category, mediaString, moment().format("YYYY-MM-DD HH:mm:ss")];

                try {
                   const [result] = await db.promise().execute(query, values);
                   const postId = result.insertId;

                    const COMMENT_PROBABILITY = 0.35;
                    const LIKE_PROBABILITY = 0.50;

                    if (Math.random() < COMMENT_PROBABILITY) {
                        const minDelay = 15 * 60 * 1000, maxDelay = 24 * 60 * 60 * 1000;
                        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                        const executeAt = moment(new Date(Date.now() + randomDelay)).format("YYYY-MM-DD HH:mm:ss");
                        const scheduleQuery = "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, post_content, execute_at) VALUES (?, ?, ?, ?, ?)";
                        db.promise().execute(scheduleQuery, [postId, userId, 'comment', description, executeAt]).catch(err => console.error("Failed to schedule bot comment:", err));
                    }

                    if (Math.random() < LIKE_PROBABILITY) {
                        const minDelay = 2 * 60 * 1000, maxDelay = 8 * 60 * 60 * 1000;
                        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                        const executeAt = moment(new Date(Date.now() + randomDelay)).format("YYYY-MM-DD HH:mm:ss");
                        const scheduleQuery = "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, execute_at) VALUES (?, ?, ?, ?)";
                        db.promise().execute(scheduleQuery, [postId, userId, 'like', executeAt]).catch(err => console.error("Failed to schedule bot like:", err));
                    }
                    
                    postCache.flushAll();
                    return res.status(201).json({ message: "Post created successfully." });

                } catch (dbError) {
                     console.error("Error inserting post into database:", dbError);
                     return res.status(500).json({ message: "Database insertion error", error: dbError.message });
                }
            });
        } catch (error) {
            console.error("Error creating post:", error);
            return res.status(500).json({ message: "Server error.", error: error.message });
        }
    });
};

const getPosts = async (req, res, queryType) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const searchTerm = req.query.searchTerm || '';
            const searchValue = `%${searchTerm}%`;
            let q;
            let params;

            const blockedUsersSubquery = `(SELECT userId FROM blocked_users WHERE blockedUserId = ? UNION SELECT blockedUserId FROM blocked_users WHERE userId = ?)`;
            const commonQueryParts = `
                SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                COUNT(DISTINCT l.id) AS likeCount,
                COUNT(DISTINCT c.id) AS commentCount,
                CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
                CASE WHEN bp.userId IS NOT NULL THEN TRUE ELSE FALSE END AS isBookmarked
                FROM posts AS p
                JOIN users AS u ON u.id = p.userId
                LEFT JOIN user_settings AS us ON u.id = us.userId
                LEFT JOIN likes AS l ON l.postId = p.id
                LEFT JOIN comments AS c ON c.postId = p.id
                LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                LEFT JOIN bookmarked_posts AS bp ON bp.postId = p.id AND bp.userId = ?
            `;

            switch (queryType) {
                case 'all':
                    q = `${commonQueryParts} LEFT JOIN reach r_check ON (p.userId = r_check.followed AND r_check.follower = ?)
                        WHERE p.userId NOT IN (${blockedUsersSubquery})
                          AND (COALESCE(us.profile_visibility, 'public') = 'public' OR (us.profile_visibility = 'private' AND r_check.follower IS NOT NULL))
                          AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                        GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                    params = [userId, userId, userId, userId, userId, searchValue, searchValue, searchValue];
                    break;
                case 'following':
                    q = `${commonQueryParts} JOIN reach AS r ON (p.userId = r.followed)
                        WHERE p.userId NOT IN (${blockedUsersSubquery})
                          AND (r.follower = ? OR p.userId = ?)
                          AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                        GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                    params = [userId, userId, userId, userId, userId, userId, searchValue, searchValue, searchValue];
                    break;
                case 'user':
                    q = `${commonQueryParts}
                        WHERE u.id = ? AND p.userId NOT IN (${blockedUsersSubquery})
                          AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                        GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                    params = [userId, userId, req.params.id, userId, userId, searchValue, searchValue, searchValue];
                    break;
                default:
                    return res.status(400).json({ message: "Invalid query type" });
            }

            const cacheKey = `posts:${queryType}:${userId}:${searchTerm}`;
            let posts = postCache.get(cacheKey);

            if (!posts) {
                const [data] = await db.promise().query(q, params);
                posts = processPosts(data);
                if (queryType !== 'user') postCache.set(cacheKey, posts);
            }
            
            res.status(200).json(posts);
        } catch (error) {
            console.error(`Error in getPosts (${queryType}):`, error);
            res.status(500).json({ message: "Failed to fetch posts", error: error.message });
        }
    });
};

export const allPosts = (req, res) => getPosts(req, res, 'all');
export const followingPosts = (req, res) => getPosts(req, res, 'following');
export const userPosts = (req, res) => getPosts(req, res, 'user');

export const postCategory = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const { category } = req.params;
            const searchTerm = req.query.searchTerm || '';
            const searchValue = `%${searchTerm}%`;

            const q = `SELECT p.*, u.id AS userId, u.username, full_name, u.profilePic,
                      COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                      CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
                      CASE WHEN bp.userId IS NOT NULL THEN TRUE ELSE FALSE END AS isBookmarked
                    FROM posts AS p 
                    JOIN users AS u ON u.id = p.userId 
                    LEFT JOIN likes AS l ON l.postId = p.id
                    LEFT JOIN comments AS c ON c.postId = p.id
                    LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                    LEFT JOIN bookmarked_posts AS bp ON bp.postId = p.id AND bp.userId = ?
                    WHERE p.category = ? AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id ORDER BY createdAt DESC`;
            
            const [data] = await db.promise().query(q, [userId, userId, category, searchValue, searchValue, searchValue]);
            if (data.length === 0) return res.status(404).json([]);
            
            const posts = processPosts(data);
            res.status(200).json(posts);
        } catch (err) {
            console.error("Error fetching posts by category:", err);
            res.status(500).json({ message: "Failed to fetch posts", error: err.message });
        }
    });
};

export const getPostById = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;

            const q = `SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                       COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                       CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
                       CASE WHEN bp.userId IS NOT NULL THEN TRUE ELSE FALSE END AS isBookmarked
                       FROM posts AS p JOIN users AS u ON u.id = p.userId
                       LEFT JOIN likes AS l ON l.postId = p.id
                       LEFT JOIN comments AS c ON c.postId = p.id
                       LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                       LEFT JOIN bookmarked_posts AS bp ON bp.postId = p.id AND bp.userId = ?
                       WHERE p.id = ? GROUP BY p.id, u.id`;

            const [data] = await db.promise().query(q, [userId, userId, postId]);
            if (data.length === 0) return res.status(404).json({ message: "Post not found" });

            const [post] = processPosts(data);
            res.status(200).json(post);
        } catch (error) {
            console.error("Error fetching post by ID:", error);
            res.status(500).json({ message: "Failed to fetch post", error: error.message });
        }
    });
};

export const bookmarkPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;
    
            const [existing] = await db.promise().query("SELECT id FROM bookmarked_posts WHERE userId = ? AND postId = ?", [userId, postId]);
    
            if (existing.length > 0) {
                await db.promise().query("DELETE FROM bookmarked_posts WHERE userId = ? AND postId = ?", [userId, postId]);
                postCache.flushAll();
                return res.status(200).json({ message: "Post removed from bookmarks." });
            } else {
                await db.promise().query("INSERT INTO bookmarked_posts (userId, postId, createdAt) VALUES (?, ?, ?)", [userId, postId, moment().format("YYYY-MM-DD HH:mm:ss")]);
                postCache.flushAll();
                return res.status(200).json({ message: "Post saved to bookmarks." });
            }
        } catch (error) {
            console.error("Error toggling bookmark:", error);
            return res.status(500).json({ message: "Failed to update bookmark status", error: error.message });
        }
    });
};

export const getBookmarkedPosts = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const q = `SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                       COUNT(DISTINCT l.id) AS likeCount, COUNT(DISTINCT c.id) AS commentCount,
                       CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
                       TRUE AS isBookmarked
                       FROM bookmarked_posts AS bp JOIN posts AS p ON bp.postId = p.id
                       JOIN users AS u ON p.userId = u.id
                       LEFT JOIN likes AS l ON l.postId = p.id
                       LEFT JOIN comments AS c ON c.postId = p.id
                       LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                       WHERE bp.userId = ? GROUP BY p.id, u.id ORDER BY bp.createdAt DESC`;

            const [data] = await db.promise().query(q, [userId, userId]);
            const posts = processPosts(data);
            res.status(200).json(posts);
        } catch (error) {
            console.error("Error fetching bookmarked posts:", error);
            res.status(500).json({ message: "Failed to fetch bookmarked posts", error: error.message });
        }
    });
};
 
export const deletePost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;
            
            const [data] = await db.promise().query("SELECT media FROM posts WHERE id = ? AND userId = ?", [postId, userId]);
            if (data.length === 0) {
                return res.status(404).json({ message: "Post not found or you are not authorized." });
            }

            const mediaKeys = data[0].media ? data[0].media.split(',') : [];
            if (mediaKeys.length > 0) {
                await Promise.all(mediaKeys.map(key => deleteS3Object(key.trim())));
            }

            const [result] = await db.promise().query("DELETE FROM posts WHERE id = ? AND userId = ?", [postId, userId]);
            if (result.affectedRows > 0) {
                postCache.flushAll();
                return res.status(200).json({ message: "Post deleted successfully." });
            } else {
                return res.status(403).json({ message: "You can only delete your own post." });
            }
        } catch (err) {
            console.error("Failed to delete post:", err);
            return res.status(500).json({ message: "Failed to delete post", error: err.message });
        }
    });
};