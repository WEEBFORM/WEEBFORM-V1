import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import NodeCache from 'node-cache';
import { generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";
const followerCache = new NodeCache({ stdTTL: 300 });

const processUsersWithS3Urls = async (users) => {
    if (!users || users.length === 0) {
        return [];
    }
    return Promise.all(
        users.map(async (user) => {
            if (user.profilePic) {
                try {
                    const profilePicKey = s3KeyFromUrl(user.profilePic);
                    user.profilePic = await generateS3Url(profilePicKey);
                } catch (error) {
                    console.error(`Error generating S3 URL for user ${user.id}:`, error);
                    user.profilePic = null; // Set to null on error
                }
            }
            return user;
        })
    );
};

//API TO FOLLOW USER
export const followUser = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const followed = parseInt(req.params.followed);

        if (!Number.isInteger(followed)) {
            return res.status(400).json({ message: "Invalid followed user ID" });
        }

        if (followed === userId) {
            return res.status(409).json({ message: "Cannot follow yourself" });
        }

        const q = "SELECT * FROM reach WHERE followed = ? AND follower = ?";
        const checkValues = [followed, userId];

        try {
            const [existingFollow] = await db.promise().query(q, checkValues);
            if (existingFollow && existingFollow.length > 0) {
                return res.status(409).json({ message: "You are already following this user" });
            }

            //QUERY DB TO FOLLOW USER
            const insertQuery = "INSERT INTO reach (followed, follower) VALUES(?, ?)";
            const values = [followed, userId];
            await db.promise().query(insertQuery, values);
            followerCache.flushAll();
            return res.status(200).json({ message: "Following user" });
        } catch (err) {
            console.error("Follow User error:", err);
            return res.status(500).json({ message: "Failed to follow user", error: err.message });
        }
    });
};

// API TO GET FOLLOWERS
export const getFollowers = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.params.userId;

        if (!Number.isInteger(Number(userId))) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const cacheKey = `followers:${userId}`;
        try {
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(cachedData);
            }

            const q = `
                SELECT u.id, u.full_name, u.profilePic 
                FROM reach AS r 
                JOIN users AS u ON r.follower = u.id 
                WHERE r.followed = ?
            `;
            const [data] = await db.promise().query(q, [userId]);

            if (data && data.length > 0) {
                const followersWithS3Urls = await Promise.all(
                    data.map(async (follower) => {
                        if (follower.profilePic) {
                            const profilePicKey = s3KeyFromUrl(follower.profilePic);
                            follower.profilePic = await generateS3Url(profilePicKey);
                        }
                        return follower;
                    })
                );
                followerCache.set(cacheKey, followersWithS3Urls);
                return res.status(200).json(followersWithS3Urls);
            } else {
                return res.status(200).json([]);
            }
        } catch (err) {
            console.error("Error fetching followers:", err);
            return res.status(500).json({ message: "Failed to get followers", error: err.message });
        }
    });
};

// API TO GET FOLLOWING (MUTUAL FOLLOWERS)
export const getFollowing = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.params.userId;

        if (!Number.isInteger(Number(userId))) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const cacheKey = `following:${userId}`;
        try {
            // CHECK CACHE
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(cachedData);
            }

            // QUERY FOR MUTUAL FOLLOWERS
            const q = `
                SELECT u.id, u.full_name, u.profilePic 
                FROM users AS u 
                WHERE u.id IN (
                    -- Users who the specified user follows
                    SELECT r1.followed 
                    FROM reach AS r1 
                    WHERE r1.follower = ?
                    
                    INTERSECT
                    
                    -- Users who follow the specified user
                    SELECT r2.follower 
                    FROM reach AS r2 
                    WHERE r2.followed = ?
                )
            `;
            
            const [data] = await db.promise().query(q, [userId, userId]);

            if (data && data.length > 0) {
                const followingWithS3Urls = await Promise.all(
                    data.map(async (following) => {
                        if (following.profilePic) {
                            try {
                                const profilePicKey = s3KeyFromUrl(following.profilePic);
                                following.profilePic = await generateS3Url(profilePicKey);
                            } catch (error) {
                                console.error("Error generating profile pic URL:", error);
                                following.profilePic = null;
                            }
                        }
                        return following;
                    })
                );
                
                followerCache.set(cacheKey, followingWithS3Urls);
                return res.status(200).json(followingWithS3Urls);
            } else {
                return res.status(200).json([]);
            }
        } catch (err) {
            console.error("Error fetching mutual followers:", err);
            return res.status(500).json({ message: "Failed to get following users", error: err.message });
        }
    });
};

// API TO GET SOCIAL DIRECTORY (FOLLOWERS, FOLLOWING, SUGGESTED)
export const getSocialDirectory = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const cacheKey = `socialDirectory:${userId}`;

        try {
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                console.log(`[Cache] Serving social directory for user ${userId} from cache.`);
                return res.status(200).json(cachedData);
            }

            //QUERY TO GET ALL BLOCKED USERS
            const blockedUsersSubquery = `
                (SELECT userId FROM blocked_users WHERE blockedUserId = ? UNION SELECT blockedUserId FROM blocked_users WHERE userId = ?)
            `;

            // GET FOLLOWERS, FOLLOWING, SUGGESTED IN PARALLEL
            const followersQuery = `
                SELECT u.id, u.full_name, u.username, u.profilePic 
                FROM reach AS r 
                JOIN users AS u ON r.follower = u.id 
                WHERE r.followed = ? AND u.id NOT IN (${blockedUsersSubquery})
            `;

            const followingQuery = `
                SELECT u.id, u.full_name, u.username, u.profilePic 
                FROM users AS u 
                WHERE u.id IN (
                    SELECT r1.followed FROM reach AS r1 WHERE r1.follower = ?
                    INTERSECT
                    SELECT r2.follower FROM reach AS r2 WHERE r2.followed = ?
                ) AND u.id NOT IN (${blockedUsersSubquery})
            `;

            const suggestedQuery = `
                SELECT u.id, u.full_name, u.username, u.profilePic, COUNT(DISTINCT friends.friend_id) AS mutualConnections
                FROM (SELECT followed AS friend_id FROM reach WHERE follower = ?) AS friends
                JOIN reach AS fof ON friends.friend_id = fof.follower
                JOIN users AS u ON fof.followed = u.id
                LEFT JOIN user_settings AS us ON u.id = us.userId
                WHERE
                    fof.followed != ?
                    AND fof.followed NOT IN (SELECT followed FROM reach WHERE follower = ?)
                    AND fof.followed NOT IN (${blockedUsersSubquery})
                    AND COALESCE(us.profile_visibility, 'public') = 'public'
                GROUP BY u.id
                ORDER BY mutualConnections DESC
                LIMIT 30;
            `;

            const popularQuery = `
                SELECT u.id, u.full_name, u.username, u.profilePic
                FROM users AS u
                JOIN (
                    SELECT followed AS userId, COUNT(*) AS followerCount
                    FROM reach
                    GROUP BY followed
                    ORDER BY followerCount DESC
                    LIMIT 100
                ) AS top_users ON u.id = top_users.userId
                LEFT JOIN user_settings AS us ON u.id = us.userId
                WHERE 
                    u.id != ? 
                    AND u.id NOT IN (${blockedUsersSubquery})
                    AND COALESCE(us.profile_visibility, 'public') = 'public'
                ORDER BY RAND()
                LIMIT 30;
            `;

            // QUERY EXECUTION
            const [
                [followers], 
                [following], 
                [suggested],
                [popular]
            ] = await Promise.all([
                db.promise().query(followersQuery, [userId, userId, userId]),
                db.promise().query(followingQuery, [userId, userId, userId, userId]),
                db.promise().query(suggestedQuery, [userId, userId, userId, userId, userId]),
                db.promise().query(popularQuery, [userId, userId, userId])
            ]);
            
            // PROCESS S3 URLS FOR DATA IN PARALLEL
            const [
                processedFollowers, 
                processedFollowing, 
                processedSuggested,
                processedPopular
            ] = await Promise.all([
                processUsersWithS3Urls(followers),
                processUsersWithS3Urls(following),
                processUsersWithS3Urls(suggested),
                processUsersWithS3Urls(popular)
            ]);
            
            const result = {
                followers: processedFollowers,
                following: processedFollowing,
                suggested: processedSuggested,
                popular: processedPopular 
            };

            followerCache.set(cacheKey, result);
            return res.status(200).json(result);

        } catch (err) {
            console.error(`Error fetching social directory for user ${userId}:`, err);
            return res.status(500).json({ message: "Failed to get social directory", error: err.message });
        }
    });
};

//API TO UNFOLLOW USERS
export const unfollowUser = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const followed = req.params.followed;

        if (!Number.isInteger(Number(followed))) {
            return res.status(400).json({ message: "Invalid followed user ID" });
        }

        const q = "DELETE FROM reach WHERE followed = ? AND follower = ?";
        const values = [followed, userId];

        try {
            await db.promise().query(q, values);
            followerCache.flushAll();
            return res.status(200).json({ message: `Unfollowed user ${followed}` });
        } catch (err) {
            console.error("Unfollow user error:", err);
            return res.status(500).json({ message: "Failed to unfollow user", error: err.message });
        }
    });
};

//CHECK FOLLOW STATUS
export const checkFollowStatus = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const profileId = parseInt(req.params.profileId); 

        if (!Number.isInteger(profileId)) {
            return res.status(400).json({ message: "Invalid profile ID" });
        }

        const q = "SELECT * FROM reach WHERE followed = ? AND follower = ?";
        const checkValues = [profileId, userId];

        try {
            const [existingFollow] = await db.promise().query(q, checkValues);

            const isFollowing = existingFollow && existingFollow.length > 0;
            return res.status(200).json({ isFollowing: isFollowing });

        } catch (err) {
            console.error("Check follow status error:", err);
            return res.status(500).json({ message: "Failed to check follow status", error: err.message });
        }
    });
};

// GET FOLLOW RECOMMENDATIONS
export const getRecommendedUsers = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        let cacheKey = `recommendedUsers:${userId}`;
        try {
            let cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(cachedData);
            }
           const q = `
                SELECT DISTINCT u.id, u.full_name, u.profilePic
                FROM reach r1
                JOIN reach r2 ON r1.followed = r2.follower
                JOIN users u ON r2.followed = u.id
                WHERE r1.follower = ?
                  AND r2.followed <> ?
                  AND NOT EXISTS (SELECT 1 FROM reach r3 WHERE r3.follower = ? AND r3.followed = r2.followed)
                  LIMIT 10;
            `;

            const [data] = await db.promise().query(q, [userId, userId, userId]);

            if (data && data.length > 0) {
                const recommendedUsersWithS3Urls = await Promise.all(
                    data.map(async (user) => {
                        if (user.profilePic) {
                            const profilePicKey = s3KeyFromUrl(user.profilePic);
                            user.profilePic = await generateS3Url(profilePicKey);
                        }
                        return user;
                    })
                );

                followerCache.set(cacheKey, recommendedUsersWithS3Urls);
                return res.status(200).json(recommendedUsersWithS3Urls);
            } else {
                return res.status(200).json([]);
            }
        } catch (err) {
            console.error("Error fetching recommended users:", err);
            return res.status(500).json({ message: "Failed to get recommended users", error: err.message });
        }
    }); 
};