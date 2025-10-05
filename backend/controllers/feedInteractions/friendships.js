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

// API TO GET SOCIAL DIRECTORY (REFACTORED AND FIXED)
export const getSocialDirectory = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const cacheKey = `socialDirectory_v8_all_users:${userId}`;

        try {
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                console.log(`[Cache] Serving social directory for user ${userId} from cache.`);
                return res.status(200).json(cachedData);
            }

            // Get IDs of Followers, Following, and Blocked Users 
            const connectionsQuery = `
                (SELECT follower AS id, 'is_follower' AS relationship FROM reach WHERE followed = ?)
                UNION
                (SELECT followed AS id, 'is_following' AS relationship FROM reach WHERE follower = ?)
                UNION
                (SELECT userId AS id, 'blocked' AS relationship FROM blocked_users WHERE blockedUserId = ?)
                UNION
                (SELECT blockedUserId AS id, 'blocked' AS relationship FROM blocked_users WHERE userId = ?);
            `;
            const [connections] = await db.promise().query(connectionsQuery, [userId, userId, userId, userId]);

            const followerIds = new Set(connections.filter(c => c.relationship === 'is_follower').map(c => c.id));
            const followingIds = new Set(connections.filter(c => c.relationship === 'is_following').map(c => c.id));
            const blockedIds = new Set(connections.filter(c => c.relationship === 'blocked').map(c => c.id));

            const mutualsIds = new Set([...followerIds].filter(id => followingIds.has(id)));
            const followersOnlyIds = new Set([...followerIds].filter(id => !mutualsIds.has(id)));
            const currentConnectionIds = new Set([...followerIds, ...followingIds]);

            // Fetch Followers and Following (Mutuals) user objects  
            const getFollowersQuery = followersOnlyIds.size > 0 ? `SELECT id, full_name, username, profilePic FROM users WHERE id IN (?)` : null;
            const getFollowingQuery = mutualsIds.size > 0 ? `SELECT id, full_name, username, profilePic FROM users WHERE id IN (?)` : null;

            const [followersResult, followingResult] = await Promise.all([
                getFollowersQuery ? db.promise().query(getFollowersQuery, [[...followersOnlyIds]]) : Promise.resolve([[]]),
                getFollowingQuery ? db.promise().query(getFollowingQuery, [[...mutualsIds]]) : Promise.resolve([[]])
            ]);
            let followers = followersResult[0];
            let following = followingResult[0];

            // Fetch Suggested Users (with fallback) 
            const excludedIdsForSuggestions = [userId, ...currentConnectionIds, ...blockedIds];
            let suggested = [];

            const suggestedQuery = `
                SELECT u.id, u.full_name, u.username, u.profilePic
                FROM (
                    SELECT fof.followed AS id, COUNT(DISTINCT friends.friend_id) AS mutualConnections
                    FROM (SELECT followed AS friend_id FROM reach WHERE follower = ?) AS friends
                    JOIN reach AS fof ON friends.friend_id = fof.follower
                    WHERE fof.followed NOT IN (?)
                    GROUP BY fof.followed
                    ORDER BY mutualConnections DESC, RAND()
                    LIMIT 30
                ) AS s
                JOIN users u ON s.id = u.id;
            `;
            const [initialSuggested] = await db.promise().query(suggestedQuery, [userId, excludedIdsForSuggestions]);
            suggested = initialSuggested;

            if (suggested.length === 0) {
                console.log(`[Social Directory] No specific suggestions for user ${userId}. Falling back to general user list.`);
                const fallbackQuery = `
                    SELECT id, full_name, username, profilePic FROM users
                    WHERE id NOT IN (?) -- FIX: REMOVED is_bot = FALSE
                    ORDER BY created_at ASC LIMIT 30;
                `;
                const [fallbackUsers] = await db.promise().query(fallbackQuery, [excludedIdsForSuggestions]);
                suggested = fallbackUsers;
            }

            // STEP 4: Fetch Discover Users (Most popular users not already followed) 
            const excludedIdsForDiscover = [userId, ...followingIds, ...blockedIds];
            
            const discoverQuery = `
                SELECT
                    u.id, u.full_name, u.username, u.profilePic,
                    COUNT(r.follower) AS follower_count
                FROM users u
                LEFT JOIN reach r ON u.id = r.followed
                WHERE u.id NOT IN (?) -- FIX: REMOVED u.is_bot = FALSE
                GROUP BY u.id
                ORDER BY follower_count DESC, u.created_at ASC;
            `;
            const [discover] = await db.promise().query(discoverQuery, [excludedIdsForDiscover]);

            // Process all images and send the final response 
            const [
                processedFollowers,
                processedFollowing,
                processedSuggested,
                processedDiscover
            ] = await Promise.all([
                processUsersWithS3Urls(followers),
                processUsersWithS3Urls(following),
                processUsersWithS3Urls(suggested),
                processUsersWithS3Urls(discover)
            ]);

            const result = {
                followers: processedFollowers,
                following: processedFollowing,
                suggested: processedSuggested,
                discover: processedDiscover
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