import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";

import NodeCache from 'node-cache';

const postCache = new NodeCache({ stdTTL: 300 }); 

const shufflePosts = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; 
    }
    return array;
};


export const fetchAndProcessPostDetails = async (postIds, requestingUserId) => {
    if (!postIds || postIds.length === 0) {
        return [];
    }

    const q = `
        SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
        COUNT(DISTINCT l.id) AS likeCount,
        COUNT(DISTINCT c.id) AS commentCount,
        CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
        CASE WHEN bp.userId IS NOT NULL THEN TRUE ELSE FALSE END AS isBookmarked
        FROM posts AS p
        JOIN users AS u ON u.id = p.userId
        LEFT JOIN likes AS l ON l.postId = p.id
        LEFT JOIN comments AS c ON c.postId = p.id
        LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
        LEFT JOIN bookmarked_posts AS bp ON bp.postId = p.id AND bp.userId = ?
        WHERE p.id IN (?)
        GROUP BY p.id, u.id
    `;

    try {
        const [data] = await db.promise().query(q, [requestingUserId, requestingUserId, postIds]);

        // CORE S3KEY TO URL LOGIC
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
        return posts;

    } catch (error) {
        console.error("Error in fetchAndProcessPostDetails:", error);
        throw error; 
    }
};

// API TO CREATE NEW POST
export const newPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr instanceof multer.MulterError) {
                    return res.status(400).json({ message: "File upload error", error: uploadErr.message });
                } else if (uploadErr) {
                    console.error("Unexpected error during file processing middleware:", uploadErr);
                    return res.status(500).json({ message: "File processing failed", error: "Internal server error during file handling" });
                }

                const userId = req.user.id;
                const { description, tags, category } = req.body;
                const media = req.files && req.files["media"] ? req.files["media"] : [];
                let uploadedMediaUrls = [];

                // Loop through media files to upload to S3 and get URLs
                for (const file of media) {
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: `uploads/posts/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                    };
                    try {
                        await s3.send(new PutObjectCommand(params));
                        uploadedMediaUrls.push(`https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`);
                    } catch (s3Error) {
                        console.error("Error uploading to S3:", s3Error);
                        return res.status(500).json({ message: "Error uploading one or more files to S3", error: s3Error.message });
                    }
                }

                // Store multiple media URLs as a comma-separated string
                const mediaString = uploadedMediaUrls.join(',');

                const query = "INSERT INTO posts (userId, description, tags, category, media, createdAt) VALUES (?, ?, ?, ?, ?, ?)";
                const values = [userId, description, tags, category, mediaString, moment().format("YYYY-MM-DD HH:mm:ss")];

                try {
                   const [result] = await db.promise().execute(query, values);
                   const postId = result.insertId;

                   // --- UNIFIED, HUMAN-LIKE ENGAGEMENT SCHEDULING ---
                    const COMMENT_PROBABILITY = 0.35; // 35% chance to schedule a comment
                    const LIKE_PROBABILITY = 0.50;    // 50% chance to schedule a like

                    // Schedule a potential 'comment' task
                    if (Math.random() < COMMENT_PROBABILITY) {
                        const minDelay = 15 * 60 * 1000; // 15 minutes
                        const maxDelay = 24 * 60 * 60 * 1000; // 24 hours
                        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                        const executeAt = moment(new Date(Date.now() + randomDelay)).format("YYYY-MM-DD HH:mm:ss");

                        const scheduleQuery = "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, post_content, execute_at) VALUES (?, ?, ?, ?, ?)";
                        const scheduleValues = [postId, userId, 'comment', description, executeAt];
                        
                        // Schedule the task (fire-and-forget, don't make the user wait)
                        db.promise().execute(scheduleQuery, scheduleValues).catch(err => {
                            console.error("Failed to schedule bot comment:", err);
                        });
                    }

                    // Schedule a potential 'like' task (independently)
                    if (Math.random() < LIKE_PROBABILITY) {
                        const minDelay = 2 * 60 * 1000; // 2 minutes
                        const maxDelay = 8 * 60 * 60 * 1000; // 8 hours
                        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                        const executeAt = moment(new Date(Date.now() + randomDelay)).format("YYYY-MM-DD HH:mm:ss");

                        // Note: 'post_content' is NULL for 'like' tasks
                        const scheduleQuery = "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, execute_at) VALUES (?, ?, ?, ?)";
                        const scheduleValues = [postId, userId, 'like', executeAt];

                        // Schedule the task (fire-and-forget)
                        db.promise().execute(scheduleQuery, scheduleValues).catch(err => {
                            console.error("Failed to schedule bot like:", err);
                        });
                    }
                    // --- END OF SCHEDULING LOGIC ---

                    postCache.flushAll(); // Clear cache to ensure new post appears in feeds
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



// HELPER FUNCTION TO FETCH POSTS
const fetchPostsData = async (q, params) => {
    try {
        const [rows] = await db.promise().query(q, params);
        return rows;
    } catch (error) {
        console.error("Error fetching posts:", error);
        throw new Error("DB_ERROR");
    }
};

// API TO GET ALL POSTS, FOLLOWING POSTS, AND USER POSTS (Consolidated)
const getPosts = async (req, res, queryType) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const searchTerm = req.query.searchTerm || '';
        const searchValue = `%${searchTerm}%`;
        let q;
        let params;

        // Reusable subquery for blocked users
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
                q = `${commonQueryParts}
                    LEFT JOIN reach r_check ON (p.userId = r_check.followed AND r_check.follower = ?)
                    WHERE 
                        p.userId NOT IN (${blockedUsersSubquery})
                        AND (COALESCE(us.profile_visibility, 'public') = 'public' OR (us.profile_visibility = 'private' AND r_check.follower IS NOT NULL))
                        AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                params = [userId, userId, userId, userId, userId, searchValue, searchValue, searchValue];
                break;
            case 'following':   
                q = `${commonQueryParts}
                    JOIN reach AS r ON (p.userId = r.followed)
                    WHERE 
                        p.userId NOT IN (${blockedUsersSubquery})
                        AND (r.follower = ? OR p.userId = ?)
                        AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                params = [userId, userId, userId, userId, userId, userId, searchValue, searchValue, searchValue];
                break; 
            case 'user':
                 q = `${commonQueryParts}
                    WHERE 
                        u.id = ? 
                        AND p.userId NOT IN (${blockedUsersSubquery})
                        AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                    GROUP BY p.id, u.id ORDER BY p.createdAt DESC`;
                params = [userId, userId, req.params.id, userId, userId, searchValue, searchValue, searchValue];
                break;
            default:
                return res.status(400).json({ message: "Invalid query type" });
        }

        try {
            let cacheKey = `posts:${queryType}:${userId}:${searchTerm}`;
            let cachedPosts = postCache.get(cacheKey);
            let posts;

            if (cachedPosts) {
                posts = cachedPosts;
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
                        if (post.profilePic.startsWith('http')) {}
                        else {
                            post.profilePic = await generateS3Url(s3KeyFromUrl(post.profilePic));
                        }
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
                      CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
                      CASE WHEN bp.userId IS NOT NULL THEN TRUE ELSE FALSE END AS isBookmarked
                    FROM posts AS p 
                    JOIN users AS u ON u.id = p.userId 
                    LEFT JOIN likes AS l ON l.postId = p.id
                    LEFT JOIN comments AS c ON c.postId = p.id
                    LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                    LEFT JOIN bookmarked_posts AS bp ON bp.postId = p.id AND bp.userId = ?
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
                        if (post.profilePic.startsWith('http')) {}
                        else {
                            post.profilePic = await generateS3Url(s3KeyFromUrl(post.profilePic));
                        }
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
                CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
                CASE WHEN bp.userId IS NOT NULL THEN TRUE ELSE FALSE END AS isBookmarked
                FROM posts AS p
                JOIN users AS u ON u.id = p.userId
                LEFT JOIN likes AS l ON l.postId = p.id
                LEFT JOIN comments AS c ON c.postId = p.id
                LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                LEFT JOIN bookmarked_posts AS bp ON bp.postId = p.id AND bp.userId = ?
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

// API TO BOOKMARK / UN-BOOKMARK A POST
export const bookmarkPost = async (req, res) => {
    const userId = req.user.id;
    const postId = req.params.id;

    try {
        // Check if the post is already bookmarked
        const checkQuery = "SELECT id FROM bookmarked_posts WHERE userId = ? AND postId = ?";
        const [existing] = await db.promise().query(checkQuery, [userId, postId]);

        if (existing.length > 0) {
            // Un-bookmark it
            const deleteQuery = "DELETE FROM bookmarked_posts WHERE userId = ? AND postId = ?";
            await db.promise().query(deleteQuery, [userId, postId]);
            postCache.flushAll();
            return res.status(200).json({ message: "Post removed from bookmarks." });
        } else {
            // Bookmark it
            const insertQuery = "INSERT INTO bookmarked_posts (userId, postId, createdAt) VALUES (?, ?, ?)";
            await db.promise().query(insertQuery, [userId, postId, moment().format("YYYY-MM-DD HH:mm:ss")]);
            postCache.flushAll();
            return res.status(200).json({ message: "Post saved to bookmarks." });
        }
    } catch (error) {
        console.error("Error toggling bookmark:", error);
        return res.status(500).json({ message: "Failed to update bookmark status", error: error.message });
    }
};


// API TO GET ALL BOOKMARKED POSTS
export const getBookmarkedPosts = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        try {
            const q = `
                SELECT p.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                COUNT(DISTINCT l.id) AS likeCount,
                COUNT(DISTINCT c.id) AS commentCount,
                CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END AS liked,
                TRUE AS isBookmarked
                FROM bookmarked_posts AS bp
                JOIN posts AS p ON bp.postId = p.id
                JOIN users AS u ON p.userId = u.id
                LEFT JOIN likes AS l ON l.postId = p.id
                LEFT JOIN comments AS c ON c.postId = p.id
                LEFT JOIN likes AS l2 ON l2.postId = p.id AND l2.userId = ?
                WHERE bp.userId = ?
                GROUP BY p.id, u.id
                ORDER BY bp.createdAt DESC
            `;
            const [data] = await db.promise().query(q, [userId, userId]);

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
                        if (post.profilePic.startsWith('http')) {}
                        else {
                            post.profilePic = await generateS3Url(s3KeyFromUrl(post.profilePic));
                        }
                    }
                    return post;
                })
            );

            res.status(200).json(posts);
        } catch (error) {
            console.error("Error fetching bookmarked posts:", error);
            res.status(500).json({ message: "Failed to fetch bookmarked posts", error: error.message });
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
                return res.status(404).json({ message: "Post not found! or user not authorized" });
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
