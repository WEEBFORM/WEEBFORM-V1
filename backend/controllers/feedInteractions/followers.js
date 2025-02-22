import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import NodeCache from 'node-cache';
const followerCache = new NodeCache({ stdTTL: 300 }); // Cache followers for 5 minutes

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
            followerCache.flushAll(); // Invalidate cache on update
            return res.status(200).json({ message: "Following user" });
        } catch (err) {
            console.error("Follow User error:", err);
            return res.status(500).json({ message: "Failed to follow user", error: err.message });
        }
    });
};

//API TO GET FOLLOWERS
export const getFollowers = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.params.userId;

        if (!Number.isInteger(Number(userId))) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        let cacheKey = `followers:${userId}`;
        try {
            let cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(cachedData);
            }

            const q = "SELECT r.follower FROM reach AS r WHERE r.followed = ?"; // Get followers of userId
            const [data] = await db.promise().query(q, [userId]);

            if (data && data.length > 0) {
                const follower = data.map(obj => Number(obj.follower));
                followerCache.set(cacheKey, follower);
                return res.status(200).json(follower);
            } else {
                return res.status(200).json([]);
            }
        } catch (err) {
            console.error("Error fetching followers:", err);
            return res.status(500).json({ message: "Failed to get followers", error: err.message });
        }
    });
};

//API TO GET FOLLOWING
export const getFollowing = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        //console.log("UserId",userId);
        if (!Number.isInteger(Number(userId))) {
            return res.status(400).json({ message: "Invalid userId" });
        }

        let cacheKey = `following:${userId}`;
        try {
            let cachedData = followerCache.get(cacheKey);
            if (cachedData) {
                //console.log("Return the cached value in getFollowing method");
                return res.status(200).json(cachedData);
            }
            const q = "SELECT r.followed FROM reach AS r WHERE r.follower = ?"; // Get users followed by userId
            const [data] = await db.promise().query(q, [userId]);

            if (data && data.length > 0) {
                const followed = data.map(obj => Number(obj.followed));
                followerCache.set(cacheKey, followed);
                return res.status(200).json(followed);
            } else {
                return res.status(200).json([]);
            }
        } catch (err) {
            console.error("Error fetching following:", err);
            return res.status(500).json({ message: "Failed to get following users", error: err.message });
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