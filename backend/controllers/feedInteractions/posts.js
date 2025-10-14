import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import NodeCache from 'node-cache';
import { processImageUrl, resizeImage } from '../../middlewares/cloudfrontConfig.js';
import { createNotification } from "../notificationsController.js";

const postCache = new NodeCache({ stdTTL: 300 });

//HELPER FUNCTION TO PROCESS POSTS (media, profile pics)
const processPosts = (posts) => {
    if (!posts || posts.length === 0) return [];
    
    return posts.map(post => {
        if (post.media) {
            const mediaArray = post.media.split(',').map(keyOrUrl => processImageUrl(keyOrUrl.trim()));
            post.media = mediaArray.length > 0 ? mediaArray : null;
        } else {
            post.media = null; 
        }
        
        if (post.profilePic) {
            post.profilePic = processImageUrl(post.profilePic);
        }
        if (post.reposterProfilePic) {
            post.reposterProfilePic = processImageUrl(post.reposterProfilePic);
        }
        
        return post;
    });
};

//HELPER TO PROCESS USERS
const processUsers = (users) => {
    if (!users || users.length === 0) return [];
    
    return users.map(user => {
        if (user.profilePic) {
            user.profilePic = processImageUrl(user.profilePic);
        }
        return user;
    });
};

//API TO NOTIFY FOLLOWERS OF NEW POST
const notifyFollowersOfNewPost = async (authorId, postId, authorUsername) => {
    try {
        const [followers] = await db.promise().query("SELECT follower FROM reach WHERE followed = ?", [authorId]);

        if (followers.length > 0) {
            const notificationPromises = followers.map(follower => {
                const type = 'NEW_POST_FROM_FOLLOWING';
                const details = { postAuthorUsername: authorUsername };
                const entityIds = { postId };

                return createNotification(
                    type,
                    authorId,
                    follower.follower,
                    entityIds,
                    details
                );
            });
            await Promise.all(notificationPromises);
        }
    } catch (error) {
        console.error(`[Notification Error] Failed to notify followers for post ${postId}:`, error);
    }
};
// API TO CREATE NEW POST
export const newPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            cpUpload(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ 
                        message: "File upload error", 
                        error: uploadErr.message 
                    });
                }

                const userId = req.user.id;
                const { description, tags, category } = req.body;
                const mediaFiles = req.files && req.files["media"] ? req.files["media"] : [];
                let uploadedMediaKeys = [];

                // RESIZE AND UPLOAD TO S3
                for (const file of mediaFiles) {
                    try {
                        const resizedBuffer = await resizeImage(file.buffer, 1080, 1080);
                        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
                        const key = `uploads/posts/${Date.now()}_${sanitizedFilename}.webp`;
                        
                        const params = { 
                            Bucket: process.env.BUCKET_NAME, 
                            Key: key, 
                            Body: resizedBuffer, 
                            ContentType: 'image/webp' 
                        };
                        
                        await s3.send(new PutObjectCommand(params));
                        uploadedMediaKeys.push(key);
                    } catch (s3Error) {
                        console.error("Error uploading to S3:", s3Error);
                        return res.status(500).json({ 
                            message: "Error uploading one or more files to S3", 
                            error: s3Error.message 
                        });
                    }
                }

                const mediaString = uploadedMediaKeys.length > 0 ? uploadedMediaKeys.join(',') : null;
                const query = "INSERT INTO posts (userId, description, tags, category, media, createdAt) VALUES (?, ?, ?, ?, ?, ?)";
                const values = [
                    userId, 
                    description, 
                    tags, 
                    category, 
                    mediaString, 
                    moment().format("YYYY-MM-DD HH:mm:ss")
                ];

                try {
                    const [result] = await db.promise().execute(query, values);
                    const postId = result.insertId;

                    // SCHEDULE BOT ENGAGEMENTS
                    const COMMENT_PROBABILITY = 0.35;
                    const LIKE_PROBABILITY = 0.50;

                    if (Math.random() < COMMENT_PROBABILITY) {
                        const minDelay = 15 * 60 * 1000; // 15 minutes
                        const maxDelay = 24 * 60 * 60 * 1000; // 24 hours
                        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                        const executeAt = moment(new Date(Date.now() + randomDelay)).format("YYYY-MM-DD HH:mm:ss");
                        
                        const scheduleQuery = "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, post_content, execute_at) VALUES (?, ?, ?, ?, ?)";
                        db.promise().execute(scheduleQuery, [postId, userId, 'comment', description, executeAt])
                            .catch(err => console.error("Failed to schedule bot comment:", err));
                    }
                    if (Math.random() < LIKE_PROBABILITY) {
                        const minDelay = 2 * 60 * 1000; // 2 minutes
                        const maxDelay = 8 * 60 * 60 * 1000; // 8 hours
                        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                        const executeAt = moment(new Date(Date.now() + randomDelay)).format("YYYY-MM-DD HH:mm:ss");
                        
                        const scheduleQuery = "INSERT INTO pending_engagements (post_id, post_author_id, engagement_type, execute_at) VALUES (?, ?, ?, ?)";
                        db.promise().execute(scheduleQuery, [postId, userId, 'like', executeAt])
                            .catch(err => console.error("Failed to schedule bot like:", err));
                    }
                    notifyFollowersOfNewPost(userId, postId, req.user.username);
                    postCache.flushAll();
                    return res.status(201).json({ message: "Post created successfully." });

                } catch (dbError) {
                    console.error("Error inserting post into database:", dbError);
                    return res.status(500).json({ 
                        message: "Database insertion error", 
                        error: dbError.message 
                    });
                }
            });
        } catch (error) {
            console.error("Error creating post:", error);
            return res.status(500).json({ 
                message: "Server error.", 
                error: error.message 
            });
        }
    });
};


//UNIFIED FUNCTION TO GET POSTS (ALL, FOLLOWING, USER)
const getPosts = async (req, res, queryType) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const searchTerm = req.query.searchTerm || '';
            const searchValue = `%${searchTerm}%`;
            let q;
            let params;

            // Post columns to select consistently across all queries
            const postColumns = `p.id, p.description, p.tags, p.category, p.media, p.shares, p.createdAt`;

            //HELPER TO BUILD FINAL QUERY WITH COMMON JOINS AND FILTERS
            const buildFinalQuery = (feedSubQuery) => `
                SELECT
                    f.*,
                    COUNT(DISTINCT l.id) AS likeCount,
                    COUNT(DISTINCT c.id) AS commentCount,
                    (CASE WHEN l2.userId IS NOT NULL THEN TRUE ELSE FALSE END) AS liked,
                    (CASE WHEN bp.userId IS NOT NULL THEN TRUE ELSE FALSE END) AS isBookmarked
                FROM (${feedSubQuery}) AS f
                LEFT JOIN likes AS l ON l.postId = f.id
                LEFT JOIN comments AS c ON c.postId = f.id
                LEFT JOIN likes AS l2 ON l2.postId = f.id AND l2.userId = ?
                LEFT JOIN bookmarked_posts AS bp ON bp.postId = f.id AND bp.userId = ?
                WHERE f.userId NOT IN (SELECT userId FROM blocked_users WHERE blockedUserId = ? UNION SELECT blockedUserId FROM blocked_users WHERE userId = ?)
                  AND (f.reposterId IS NULL OR f.reposterId NOT IN (SELECT userId FROM blocked_users WHERE blockedUserId = ? UNION SELECT blockedUserId FROM blocked_users WHERE userId = ?))
                  AND (f.full_name LIKE ? OR f.username LIKE ? OR f.description LIKE ?)
                GROUP BY f.uniqueFeedId, f.id, f.userId, f.username, f.full_name, f.profilePic, 
                         f.reposterId, f.reposterUsername, f.reposterFullName, f.reposterProfilePic, 
                         f.description, f.tags, f.category, f.media, f.shares, f.createdAt, f.activityDate
                ORDER BY f.activityDate DESC
            `;

            switch (queryType) {
                case 'all':
                    // ALL POSTS
                    const allFeedQuery = `
                        SELECT * FROM (
                            -- Original Posts from public users or followed private users
                            SELECT 
                                ${postColumns}, 
                                u.id AS userId, u.username, u.full_name, u.profilePic,
                                NULL as reposterId, NULL as reposterUsername, 
                                NULL as reposterFullName, NULL as reposterProfilePic, 
                                p.createdAt as activityDate, 
                                CONCAT('post_', p.id) as uniqueFeedId
                            FROM posts p
                            JOIN users u ON p.userId = u.id
                            LEFT JOIN user_settings us ON u.id = us.userId
                            LEFT JOIN reach r_check ON (p.userId = r_check.followed AND r_check.follower = ?)
                            WHERE (COALESCE(us.profile_visibility, 'public') = 'public' OR r_check.follower IS NOT NULL)

                            UNION ALL

                            -- Reposted Posts from public users or followed private users
                            SELECT 
                                ${postColumns}, 
                                u.id AS userId, u.username, u.full_name, u.profilePic,
                                reposter.id as reposterId, reposter.username as reposterUsername, 
                                reposter.full_name as reposterFullName, reposter.profilePic as reposterProfilePic, 
                                rp.createdAt as activityDate, 
                                CONCAT('repost_', rp.id) as uniqueFeedId
                            FROM reposts rp
                            JOIN posts p ON rp.postId = p.id
                            JOIN users u ON p.userId = u.id
                            JOIN users reposter ON rp.userId = reposter.id
                            LEFT JOIN user_settings us ON reposter.id = us.userId
                            LEFT JOIN reach r_check ON (rp.userId = r_check.followed AND r_check.follower = ?)
                            WHERE (COALESCE(us.profile_visibility, 'public') = 'public' OR r_check.follower IS NOT NULL)
                        ) AS feed
                    `;
                    q = buildFinalQuery(allFeedQuery);
                    params = [
                        userId, userId, // For allFeedQuery (visibility checks)
                        userId, userId, // For buildFinalQuery (likes, bookmarks)
                        userId, userId, userId, userId, // For blocked users subqueries (2 subqueries x 2 params each)
                        searchValue, searchValue, searchValue // Search terms
                    ];
                    break;

                case 'following':
                    // FOLLOWING POSTS
                    const followingFeedQuery = `
                        SELECT * FROM (
                            -- Original posts by followed users or self
                            SELECT 
                                ${postColumns}, 
                                u.id AS userId, u.username, u.full_name, u.profilePic,
                                NULL as reposterId, NULL as reposterUsername, 
                                NULL as reposterFullName, NULL as reposterProfilePic, 
                                p.createdAt as activityDate, 
                                CONCAT('post_', p.id) as uniqueFeedId
                            FROM posts p
                            JOIN users u ON p.userId = u.id
                            LEFT JOIN reach r_reach ON p.userId = r_reach.followed
                            WHERE (r_reach.follower = ? OR p.userId = ?)

                            UNION ALL

                            -- Reposts by followed users or self
                            SELECT 
                                ${postColumns}, 
                                u.id AS userId, u.username, u.full_name, u.profilePic,
                                reposter.id as reposterId, reposter.username as reposterUsername, 
                                reposter.full_name as reposterFullName, reposter.profilePic as reposterProfilePic, 
                                rp.createdAt as activityDate, 
                                CONCAT('repost_', rp.id) as uniqueFeedId
                            FROM reposts rp
                            JOIN posts p ON rp.postId = p.id
                            JOIN users u ON p.userId = u.id
                            JOIN users reposter ON rp.userId = reposter.id
                            LEFT JOIN reach r_reach ON rp.userId = r_reach.followed
                            WHERE (r_reach.follower = ? OR rp.userId = ?)
                        ) AS feed
                    `;
                    q = buildFinalQuery(followingFeedQuery);
                    params = [
                        userId, userId, // For followingFeedQuery (following checks)
                        userId, userId, // For followingFeedQuery (repost checks)
                        userId, userId, // For buildFinalQuery (likes, bookmarks)
                        userId, userId, userId, userId, // For blocked users subqueries (2 subqueries x 2 params each)
                        searchValue, searchValue, searchValue // Search terms
                    ];
                    break;

                case 'user':
                    // User profile: Original posts + Reposts by specific user
                    const targetUserId = req.params.id;
                    const userFeedQuery = `
                        SELECT * FROM (
                            -- Original posts by the target user
                            SELECT 
                                ${postColumns}, 
                                u.id AS userId, u.username, u.full_name, u.profilePic,
                                NULL as reposterId, NULL as reposterUsername, 
                                NULL as reposterFullName, NULL as reposterProfilePic, 
                                p.createdAt as activityDate, 
                                CONCAT('post_', p.id) as uniqueFeedId
                            FROM posts p
                            JOIN users u ON p.userId = u.id
                            WHERE p.userId = ?

                            UNION ALL

                            -- Reposts by the target user
                            SELECT 
                                ${postColumns}, 
                                u.id AS userId, u.username, u.full_name, u.profilePic,
                                reposter.id as reposterId, reposter.username as reposterUsername, 
                                reposter.full_name as reposterFullName, reposter.profilePic as reposterProfilePic, 
                                rp.createdAt as activityDate, 
                                CONCAT('repost_', rp.id) as uniqueFeedId
                            FROM reposts rp
                            JOIN posts p ON rp.postId = p.id
                            JOIN users u ON p.userId = u.id
                            JOIN users reposter ON rp.userId = reposter.id
                            WHERE rp.userId = ?
                        ) AS feed
                    `;
                    q = buildFinalQuery(userFeedQuery);
                    params = [
                        targetUserId, targetUserId, // For userFeedQuery (target user)
                        userId, userId, // For buildFinalQuery (likes, bookmarks)
                        userId, userId, userId, userId, // For blocked users subqueries (2 subqueries x 2 params each)
                        searchValue, searchValue, searchValue // Search terms
                    ];
                    break;

                default:
                    return res.status(400).json({ message: "Invalid query type" });
            }

            // CONSTRUCT CACHE KEY
            const cacheKey = `posts:${queryType}:${queryType === 'user' ? req.params.id : userId}:${searchTerm}`;
            let posts = postCache.get(cacheKey);

            if (!posts) {
                const [data] = await db.promise().query(q, params);
                posts = processPosts(data);
                
                // CACHE ALL POSTS AND FOLLOWING POSTS (but not user-specific feeds)
                if (queryType !== 'user') {
                    postCache.set(cacheKey, posts);
                }
            }
            
            res.status(200).json(posts);
        } catch (error) {
            console.error(`Error in getPosts (${queryType}):`, error);
            res.status(500).json({ 
                message: "Failed to fetch posts", 
                error: error.message 
            });
        }
    });
};

// EXPORT SPECIFIC FIELS ENDPOINTS
export const allPosts = (req, res) => getPosts(req, res, 'all');
export const followingPosts = (req, res) => getPosts(req, res, 'following');
export const userPosts = (req, res) => getPosts(req, res, 'user');

//FETCH POSTS BY CATEGORY WITH SEARCH
export const postCategory = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const { category } = req.params;
            const searchTerm = req.query.searchTerm || '';
            const searchValue = `%${searchTerm}%`;

            const q = `
                SELECT p.*, u.id AS userId, u.username, full_name, u.profilePic,
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
                WHERE p.category = ? 
                  AND (u.full_name LIKE ? OR u.username LIKE ? OR p.description LIKE ?)
                GROUP BY p.id, u.id 
                ORDER BY p.createdAt DESC
            `;
            
            const [data] = await db.promise().query(q, [
                userId, userId, category, 
                searchValue, searchValue, searchValue
            ]);
            
            if (data.length === 0) {
                return res.status(404).json([]);
            }
            
            const posts = processPosts(data);
            res.status(200).json(posts);
        } catch (err) {
            console.error("Error fetching posts by category:", err);
            res.status(500).json({ 
                message: "Failed to fetch posts", 
                error: err.message 
            });
        }
    });
};

// FETCH SINGLE POST BY ID
export const getPostById = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;

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
                WHERE p.id = ? 
                GROUP BY p.id, u.id
            `;

            const [data] = await db.promise().query(q, [userId, userId, postId]);
            
            if (data.length === 0) {
                return res.status(404).json({ message: "Post not found" });
            }

            const [post] = processPosts(data);
            res.status(200).json(post);
        } catch (error) {
            console.error("Error fetching post by ID:", error);
            res.status(500).json({ 
                message: "Failed to fetch post", 
                error: error.message 
            });
        }
    });
};

// TOGGLE BOOKMARK POST
export const bookmarkPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;
    
            const [existing] = await db.promise().query(
                "SELECT id FROM bookmarked_posts WHERE userId = ? AND postId = ?", 
                [userId, postId]
            );
    
            if (existing.length > 0) {
                // Remove bookmark
                await db.promise().query(
                    "DELETE FROM bookmarked_posts WHERE userId = ? AND postId = ?", 
                    [userId, postId]
                );
                postCache.flushAll();
                return res.status(200).json({ message: "Post removed from bookmarks." });
            } else {
                // Add bookmark
                await db.promise().query(
                    "INSERT INTO bookmarked_posts (userId, postId, createdAt) VALUES (?, ?, ?)", 
                    [userId, postId, moment().format("YYYY-MM-DD HH:mm:ss")]
                );
                postCache.flushAll();
                return res.status(200).json({ message: "Post saved to bookmarks." });
            }
        } catch (error) {
            console.error("Error toggling bookmark:", error);
            return res.status(500).json({ 
                message: "Failed to update bookmark status", 
                error: error.message 
            });
        }
    });
};

// FETCH ALL BOOKMARKED POSTS
export const getBookmarkedPosts = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            
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
            const posts = processPosts(data);
            res.status(200).json(posts);
        } catch (error) {
            console.error("Error fetching bookmarked posts:", error);
            res.status(500).json({ 
                message: "Failed to fetch bookmarked posts", 
                error: error.message 
            });
        }
    });
};

// SHARE POST AND TRACK SHARES
export const sharePost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;

            // CHECK IF USER ALREADY SHARED
            const checkQuery = "SELECT id FROM post_shares WHERE postId = ? AND userId = ?";
            const [existingShare] = await db.promise().query(checkQuery, [postId, userId]);
            
            if (existingShare.length > 0) {
                return res.status(200).json({ 
                    message: "You have already shared this post.",
                    alreadyShared: true 
                });
            }

            // RECORD AND SHARE INCREMENT COUNTER
            const shareQuery = "INSERT INTO post_shares (postId, userId, sharedAt) VALUES (?, ?, ?)";
            await db.promise().query(shareQuery, [
                postId, userId, 
                moment().format("YYYY-MM-DD HH:mm:ss")
            ]);
            
            const incrementQuery = "UPDATE posts SET shares = shares + 1 WHERE id = ?";
            await db.promise().query(incrementQuery, [postId]);
            
            postCache.flushAll();
            await createNotification('POST_SHARE', userId, postId, req.user.username);
            res.status(200).json({ 
                message: "Post shared successfully.",
                alreadyShared: false 
            });
        } catch (error) {
            console.error("Error sharing post:", error);
            
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(404).json({ message: "Post not found." });
            }
            
            res.status(500).json({ 
                message: "Failed to share post", 
                error: error.message 
            });
        }
    });
};

// TOGGLE REPOST
export const toggleRepost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;

            // Check if repost exists
            const [existingRepost] = await db.promise().query(
                "SELECT id FROM reposts WHERE postId = ? AND userId = ?", 
                [postId, userId]
            );

            if (existingRepost.length > 0) {
                await db.promise().query(
                    "DELETE FROM reposts WHERE postId = ? AND userId = ?", 
                    [postId, userId]
                );
                postCache.flushAll();
                return res.status(200).json({ 
                    message: "Repost removed successfully.", 
                    reposted: false 
                });
            } else {
                // Create repost
                await db.promise().query(
                    "INSERT INTO reposts (postId, userId, createdAt) VALUES (?, ?, ?)", 
                    [postId, userId, moment().format("YYYY-MM-DD HH:mm:ss")]
                );
                postCache.flushAll();
                return res.status(200).json({ 
                    message: "Post reposted successfully.", 
                    reposted: true 
                });
            }
        } catch (error) {
            console.error("Error toggling repost:", error);
            res.status(500).json({ 
                message: "Failed to toggle repost status", 
                error: error.message 
            });
        }
    });
};

// GET LIST OF USERS WHO REPOSTED A POST
export const getReposts = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const postId = req.params.id;
            
            const query = `
                SELECT u.id, u.username, u.full_name, u.profilePic
                FROM users u
                JOIN reposts r ON u.id = r.userId
                WHERE r.postId = ?
                ORDER BY r.createdAt DESC
            `;

            const [users] = await db.promise().query(query, [postId]);
            const processedUsers = processUsers(users);
            
            res.status(200).json(processedUsers);
        } catch (error) {
            console.error("Error fetching reposts:", error);
            res.status(500).json({ 
                message: "Failed to fetch reposts", 
                error: error.message 
            });
        }
    });
};

// DELETE POST AND ASSOCIATED MEDIA FROM S3
export const deletePost = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const postId = req.params.id;
            const [data] = await db.promise().query(
                "SELECT media FROM posts WHERE id = ? AND userId = ?", 
                [postId, userId]
            );
            
            if (data.length === 0) {
                return res.status(404).json({ 
                    message: "Post not found or you are not authorized." 
                });
            }

            // DELETE MEDIA FROM S3
            const mediaKeys = data[0].media ? data[0].media.split(',') : [];
            if (mediaKeys.length > 0) {
                await Promise.all(
                    mediaKeys.map(key => deleteS3Object(key.trim()))
                );
            }

            // DELETE POST FROM DB
            const [result] = await db.promise().query(
                "DELETE FROM posts WHERE id = ? AND userId = ?", 
                [postId, userId]
            );
            
            if (result.affectedRows > 0) {
                postCache.flushAll();
                return res.status(200).json({ 
                    message: "Post deleted successfully." 
                });
            } else {
                return res.status(403).json({ 
                    message: "You can only delete your own post." 
                });
            }
        } catch (err) {
            console.error("Failed to delete post:", err);
            return res.status(500).json({ 
                message: "Failed to delete post", 
                error: err.message 
            });
        }
    });
};