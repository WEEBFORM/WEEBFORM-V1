import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import NodeCache from 'node-cache';
import { processImageUrl } from '../../middlewares/cloudfrontConfig.js';
import { createNotification } from "../Users/notificationsController.js";

const followerCache = new NodeCache({ stdTTL: 300 });

//SYNCHRONOUS HELPER TO PROCESS USER PROFILE PICS
const processUsers = (users) => {
    if (!users || users.length === 0) {
        return [];
    }
    return users.map(user => {
        if (user.profilePic) {
            user.profilePic = processImageUrl(user.profilePic);
        }
        return user;
    });
};

//API TO FOLLOW USER
export const followUser = async (req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const userId = req.user.id;
      const followed = parseInt(req.params.followed);

      if (!Number.isInteger(followed) || followed <= 0) {
        return res.status(400).json({ message: "Invalid followed user ID" });
      }

      if (followed === userId) {
        return res.status(409).json({ message: "Cannot follow yourself" });
      }
      
      const [existingFollow] = await db
        .promise()
        .query("SELECT * FROM reach WHERE followed = ? AND follower = ?", [
          followed,
          userId,
        ]);
      if (existingFollow.length > 0) {
        return res
          .status(409)
          .json({ message: "You are already following this user" });
      }

      await db
        .promise()
        .query("INSERT INTO reach (followed, follower) VALUES(?, ?)", [
          followed,
          userId,
        ]);
      followerCache.flushAll();

      // Create notification
      await createNotification("FOLLOW", userId, followed);

      return res.status(200).json({ message: "Following user" });
    } catch (err) {
      console.error("Follow User error:", err);
      return res
        .status(500)
        .json({ message: "Failed to follow user", error: err.message });
    }
  });
};

// API TO GET FOLLOWERS (Refactored)
export const getFollowers = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.params.userId;
            if (!Number.isInteger(Number(userId))) {
                return res.status(400).json({ message: "Invalid user ID" });
            }
    
            const cacheKey = `followers:${userId}`;
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) return res.status(200).json(cachedData);
    
            const q = `SELECT u.id, u.full_name, u.username, u.profilePic FROM reach AS r JOIN users AS u ON r.follower = u.id WHERE r.followed = ?`;
            const [data] = await db.promise().query(q, [userId]);
    
            const processedFollowers = processUsers(data);
            followerCache.set(cacheKey, processedFollowers);
            return res.status(200).json(processedFollowers);

        } catch (err) {
            console.error("Error fetching followers:", err);
            return res.status(500).json({ message: "Failed to get followers", error: err.message });
        }
    });
};

// API TO GET FOLLOWING (MUTUAL FOLLOWERS) (Refactored)
export const getFollowing = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.params.userId;
            if (!Number.isInteger(Number(userId))) {
                return res.status(400).json({ message: "Invalid user ID" });
            }
    
            const cacheKey = `following:${userId}`;
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) return res.status(200).json(cachedData);

            const q = `SELECT u.id, u.full_name, u.username, u.profilePic FROM users AS u WHERE u.id IN (
                        SELECT r1.followed FROM reach AS r1 WHERE r1.follower = ?
                        INTERSECT
                        SELECT r2.follower FROM reach AS r2 WHERE r2.followed = ?
                       )`;
            
            const [data] = await db.promise().query(q, [userId, userId]);
            
            const processedFollowing = processUsers(data);
            followerCache.set(cacheKey, processedFollowing);
            return res.status(200).json(processedFollowing);

        } catch (err) {
            console.error("Error fetching mutual followers:", err);
            return res.status(500).json({ message: "Failed to get following users", error: err.message });
        }
    });
};

// API TO GET SOCIAL DIRECTORY (Refactored)
export const getSocialDirectory = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const cacheKey = `socialDirectory_v8_all_users:${userId}`;

        try {
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) return res.status(200).json(cachedData);

            const connectionsQuery = `
                (SELECT follower AS id, 'is_follower' AS r FROM reach WHERE followed = ?) UNION
                (SELECT followed AS id, 'is_following' AS r FROM reach WHERE follower = ?) UNION
                (SELECT userId AS id, 'blocked' AS r FROM blocked_users WHERE blockedUserId = ?) UNION
                (SELECT blockedUserId AS id, 'blocked' AS r FROM blocked_users WHERE userId = ?);`;
            
            const [connections] = await db.promise().query(connectionsQuery, [userId, userId, userId, userId]);

            const followerIds = new Set(connections.filter(c => c.r === 'is_follower').map(c => c.id));
            const followingIds = new Set(connections.filter(c => c.r === 'is_following').map(c => c.id));
            const blockedIds = new Set(connections.filter(c => c.r === 'blocked').map(c => c.id));
            const mutualsIds = new Set([...followerIds].filter(id => followingIds.has(id)));
            const followersOnlyIds = new Set([...followerIds].filter(id => !mutualsIds.has(id)));
            const currentConnectionIds = new Set([...followerIds, ...followingIds]);

            const getFollowersQuery = followersOnlyIds.size > 0 ? db.promise().query(`SELECT id, full_name, username, profilePic FROM users WHERE id IN (?)`, [[...followersOnlyIds]]) : Promise.resolve([[]]);
            const getFollowingQuery = mutualsIds.size > 0 ? db.promise().query(`SELECT id, full_name, username, profilePic FROM users WHERE id IN (?)`, [[...mutualsIds]]) : Promise.resolve([[]]);

            const [[followers], [following]] = await Promise.all([getFollowersQuery, getFollowingQuery]);

            const excludedIdsForSuggestions = [userId, ...currentConnectionIds, ...blockedIds];
            const suggestedQuery = `
                SELECT u.id, u.full_name, u.username, u.profilePic FROM (
                    SELECT fof.followed AS id FROM (SELECT followed AS friend_id FROM reach WHERE follower = ?) AS friends
                    JOIN reach AS fof ON friends.friend_id = fof.follower
                    WHERE fof.followed NOT IN (?) GROUP BY fof.followed
                    ORDER BY COUNT(DISTINCT friends.friend_id) DESC, RAND() LIMIT 30
                ) AS s JOIN users u ON s.id = u.id;`;
            
            let [suggested] = await db.promise().query(suggestedQuery, [userId, excludedIdsForSuggestions]);

            if (suggested.length === 0) {
                const fallbackQuery = `SELECT id, full_name, username, profilePic FROM users WHERE id NOT IN (?) ORDER BY created_at ASC LIMIT 30;`;
                [suggested] = await db.promise().query(fallbackQuery, [excludedIdsForSuggestions]);
            }

            const excludedIdsForDiscover = [userId, ...followingIds, ...blockedIds];
            const discoverQuery = `
                SELECT u.id, u.full_name, u.username, u.profilePic, COUNT(r.follower) AS follower_count
                FROM users u LEFT JOIN reach r ON u.id = r.followed
                WHERE u.id NOT IN (?) GROUP BY u.id
                ORDER BY follower_count DESC, u.created_at ASC;`;
            
            const [discover] = await db.promise().query(discoverQuery, [excludedIdsForDiscover]);

            const result = {
                followers: processUsers(followers),
                following: processUsers(following),
                suggested: processUsers(suggested),
                discover: processUsers(discover)
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
        try {
            const userId = req.user.id;
            const followed = req.params.followed;
    
            if (!Number.isInteger(Number(followed))) {
                return res.status(400).json({ message: "Invalid followed user ID" });
            }
    
            await db.promise().query("DELETE FROM reach WHERE followed = ? AND follower = ?", [followed, userId]);
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
        try {
            const userId = req.user.id;
            const profileId = parseInt(req.params.profileId);
    
            if (!Number.isInteger(profileId)) {
                return res.status(400).json({ message: "Invalid profile ID" });
            }
    
            const [existingFollow] = await db.promise().query("SELECT * FROM reach WHERE followed = ? AND follower = ?", [profileId, userId]);
            return res.status(200).json({ isFollowing: existingFollow.length > 0 });
        } catch (err) {
            console.error("Check follow status error:", err);
            return res.status(500).json({ message: "Failed to check follow status", error: err.message });
        }
    });
};

// GET FOLLOW RECOMMENDATIONS (Refactored)
export const getRecommendedUsers = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const cacheKey = `recommendedUsers:${userId}`;
            
            const cachedData = followerCache.get(cacheKey);
            if (cachedData) return res.status(200).json(cachedData);
            
            const q = `
                SELECT DISTINCT u.id, u.full_name, u.username, u.profilePic
                FROM reach r1
                JOIN reach r2 ON r1.followed = r2.follower
                JOIN users u ON r2.followed = u.id
                WHERE r1.follower = ? AND r2.followed != ?
                  AND NOT EXISTS (SELECT 1 FROM reach r3 WHERE r3.follower = ? AND r3.followed = r2.followed)
                LIMIT 10;
            `;

            const [data] = await db.promise().query(q, [userId, userId, userId]);
            const recommendedUsers = processUsers(data);
            
            followerCache.set(cacheKey, recommendedUsers);
            return res.status(200).json(recommendedUsers);

        } catch (err) {
            console.error("Error fetching recommended users:", err);
            return res.status(500).json({ message: "Failed to get recommended users", error: err.message });
        }
    }); 
};