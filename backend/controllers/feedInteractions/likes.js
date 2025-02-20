import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import NodeCache from 'node-cache';

const likeCache = new NodeCache({ stdTTL: 300 }); // Cache likes for 5 minutes

// API TO LIKE POST
export const like = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = parseInt(req.params.postId);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ message: "Invalid postId" });
        }
        // Use individual placeholders for userId and postId
        const q = "INSERT INTO likes (userId, postId) VALUES(?, ?)";
        // Pass userId and postId as separate parameters
        const values = [userId, postId];
        try {
            await db.promise().query(q, values);
            likeCache.flushAll()
            return res.status(200).json("liked post");
        } catch (err) {
            console.error("Like post error:", err);
            return res.status(500).json({ message: "Failed to like post", error: err.message });
        }
    });
};

// API TO GET LIKES
export const getLikes = async (req, res) => {
    const postId = parseInt(req.params.postId);
      if (!Number.isInteger(postId)) {
            return res.status(400).json({ message: "Invalid postId" });
        }

    let cacheKey = `likes:${postId}`;

    try {
         // First, check the cache
         const cachedData = likeCache.get(cacheKey);

             if (cachedData) {
                  return res.status(200).json(cachedData);
               } else {
                const q = "SELECT l.*, u.username, u.id AS userId FROM likes AS l JOIN users AS u ON (u.id = l.userId) WHERE l.postId = ?";
                  const [rows] = await db.promise().query(q, [postId]);
                     const userId = rows.map(row => row.userId);
                    const likeData = { userId, data: rows }; // Package the data
                   likeCache.set(cacheKey, likeData);
                  return res.status(200).json(likeData);
              }
    } catch (err) {
        console.error("Error fetching likes:", err);
        return res.status(500).json({ message: "Failed to fetch likes", error: err.message });
    }
};

// API TO UNLIKE POST
export const unlike = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = parseInt(req.params.postId);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ message: "Invalid postId" });
        }
        const q = "DELETE FROM likes WHERE postId = ? AND userId = ? ";
        const values = [postId, userId];
        try {
            await db.promise().query(q, values);
             likeCache.flushAll()
            return res.status(200).json({ message: `Unliked post` });
        } catch (err) {
            console.error("Error unliking post:", err);
            return res.status(500).json({ message: "Failed to unlike post", error: err.message });
        }
    });
};