import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import NodeCache from 'node-cache';
import { createNotification, deleteNotification } from "../Notifications/notificationsController.js";

const likeCache = new NodeCache({ stdTTL: 300 }); 

//API TO LIKE POST
export const like = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const postId = parseInt(req.params.postId);

    if (!Number.isInteger(postId)) {
      return res.status(400).json({ message: "Invalid postId" });
    }

    try {
      // First, get the post owner's ID so we have it for both liking and unliking
      const [post] = await db.promise().query("SELECT userId FROM posts WHERE id = ?", [postId]);
      if (post.length === 0) {
        return res.status(404).json({ message: "Post not found" });
      }
      const postOwnerId = post[0].userId;

      const [existingLike] = await db.promise().query("SELECT id FROM likes WHERE userId = ? AND postId = ?", [userId, postId]);

      // --- UNLIKE LOGIC ---
      if (existingLike.length > 0) {
        await db.promise().query("DELETE FROM likes WHERE postId = ? AND userId = ?", [postId, userId]);
        likeCache.flushAll();

        // --- IMPROVEMENT: Delete the corresponding notification ---
        if (postOwnerId !== userId) {
          await deleteNotification("LIKE_POST", userId, postOwnerId, { postId });
        }
        
        return res.status(200).json({ 
          message: "Post unliked successfully",
          liked: false 
        });

      // --- LIKE LOGIC ---
      } else {
        await db.promise().query("INSERT INTO likes (userId, postId) VALUES(?, ?)", [userId, postId]);
        likeCache.flushAll();

        // Prevent users from notifying themselves
        if (postOwnerId !== userId) {
          // --- FIX: Correctly call createNotification with all required arguments ---
          await createNotification(
            "LIKE_POST",          // 1. type
            userId,               // 2. senderId
            postOwnerId,          // 3. recipientId
            { postId: postId },   // 4. entityIds (as an object)
            { senderUsername: req.user.username } // 5. details (as an object)
          );
        }

        return res.status(200).json({ 
          message: "Post liked successfully",
          liked: true 
        });
      }
    } catch (err) {
      console.error("Like/Unlike post error:", err);
      // ... (your existing error handling) ...
      return res.status(500).json({ 
        message: "Failed to toggle like status", 
        error: err.message 
      });
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
         const cachedData = likeCache.get(cacheKey);

             if (cachedData) {
                  return res.status(200).json(cachedData);
               } else {
                const q = "SELECT l.*, u.username, u.id AS userId FROM likes AS l JOIN users AS u ON (u.id = l.userId) WHERE l.postId = ?";
                    const [rows] = await db.promise().query(q, [postId]);
                    const userId = rows.map(row => row.userId);
                    const likeData = { userId, data: rows }; 
                
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