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
                if (user.profilePic.startsWith('http')) {} 
                else {
                    try {
                        const profilePicKey = s3KeyFromUrl(user.profilePic);
                        user.profilePic = await generateS3Url(profilePicKey);
                    } catch (error) {
                        console.error(`Error generating S3 URL for user ${user.id}:`, error);
                        user.profilePic = null; // Set to null on error
                    }
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
        const cacheKey = `socialDirectory_v3:${userId}`; // Changed version to avoid old cache

        try {
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                console.log(`[Cache] Serving social directory for user ${userId} from cache.`);
                return res.status(200).json(cachedData);
            }

            // --- THIS IS THE CORRECTED QUERY ---
            const unifiedQuery = `
                WITH
                UserFollowers AS (SELECT follower AS id FROM reach WHERE followed = ?),
                UserFollowing AS (SELECT followed AS id FROM reach WHERE follower = ?),
                BlockedUsers AS (
                    SELECT userId AS id FROM blocked_users WHERE blockedUserId = ?
                    UNION
                    SELECT blockedUserId AS id FROM blocked_users WHERE userId = ?
                ),
                FollowersOnly AS (
                    SELECT id FROM UserFollowers
                    WHERE id NOT IN (SELECT id FROM UserFollowing)
                ),
                Mutuals AS (
                    SELECT id FROM UserFollowing
                    WHERE id IN (SELECT id FROM UserFollowers)
                ),
                CurrentConnections AS (
                    SELECT id FROM UserFollowers
                    UNION
                    SELECT id FROM UserFollowing
                ),
                Suggested AS (
                    SELECT fof.followed AS id
                    FROM (SELECT followed AS friend_id FROM reach WHERE follower = ?) AS friends
                    JOIN reach AS fof ON friends.friend_id = fof.follower
                    LEFT JOIN users AS u_check ON fof.followed = u_check.id
                    LEFT JOIN user_settings AS us ON u_check.id = us.userId
                    WHERE fof.followed != ?
                      AND fof.followed NOT IN (SELECT id FROM CurrentConnections)
                      AND fof.followed NOT IN (SELECT id FROM BlockedUsers)
                      AND COALESCE(us.profile_visibility, 'public') = 'public'
                    GROUP BY fof.followed
                    ORDER BY COUNT(DISTINCT friends.friend_id) DESC, RAND()
                    LIMIT 30
                )
                -- Select users for each category
                SELECT u.id, u.full_name, u.username, u.profilePic, 'followers' AS category
                FROM users u JOIN FollowersOnly fo ON u.id = fo.id
                WHERE u.id NOT IN (SELECT id FROM BlockedUsers)

                UNION ALL

                SELECT u.id, u.full_name, u.username, u.profilePic, 'following' AS category
                FROM users u JOIN Mutuals m ON u.id = m.id
                WHERE u.id NOT IN (SELECT id FROM BlockedUsers)

                UNION ALL

                SELECT u.id, u.full_name, u.username, u.profilePic, 'suggested' AS category
                FROM users u JOIN Suggested s ON u.id = s.id
                
                UNION ALL

                -- FIX APPLIED HERE: The final SELECT is now wrapped so its ORDER BY is contained.
                (SELECT u.id, u.full_name, u.username, u.profilePic, 'discover' AS category
                FROM users u
                LEFT JOIN (
                    SELECT followed, COUNT(*) AS follower_count
                    FROM reach
                    GROUP BY followed
                ) AS popular ON u.id = popular.followed
                LEFT JOIN user_settings AS us ON u.id = us.userId
                WHERE u.id != ?
                  AND u.id NOT IN (SELECT id FROM CurrentConnections)
                  AND u.id NOT IN (SELECT id FROM Suggested)
                  AND u.id NOT IN (SELECT id FROM BlockedUsers)
                  AND COALESCE(us.profile_visibility, 'public') = 'public'
                ORDER BY
                    CASE WHEN popular.follower_count IS NOT NULL THEN 0 ELSE 1 END,
                    popular.follower_count DESC,
                    u.created_at ASC);
            `;

            const [allUsers] = await db.promise().query(unifiedQuery, [
                userId, userId, userId, userId, userId, userId, userId
            ]);
            
            const processedUsers = await processUsersWithS3Urls(allUsers);

            const result = {
                followers: processedUsers.filter(u => u.category === 'followers'),
                following: processedUsers.filter(u => u.category === 'following'),
                suggested: processedUsers.filter(u => u.category === 'suggested'),
                discover: processedUsers.filter(u => u.category === 'discover').map(({ category, ...user }) => user) // Remove category field
            };
            
            // Clean up temporary category field from other sections
            result.followers.forEach(u => delete u.category);
            result.following.forEach(u => delete u.category);
            result.suggested.forEach(u => delete u.category);

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