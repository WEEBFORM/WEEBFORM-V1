import { db } from "../../../config/connectDB.js";
import { authenticateUser } from "../../../middlewares/verify.mjs";
import NodeCache from 'node-cache';
import { processImageUrl } from '../../../middlewares/cloudfrontConfig.js';

const likeCache = new NodeCache({ stdTTL: 300 });

// API TO LIKE A COMMUNITY POST
export const like = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const communityPostId = parseInt(req.params.communityPostId);
            if (!Number.isInteger(communityPostId)) {
                return res.status(400).json({ message: "Invalid communityPostId" });
            }
            
            // FETCH POST DETAILS FOR NOTIFICATION
            const [postDetails] = await db.promise().query(
                `SELECT cp.userId as authorId, c.title as communityTitle, c.id as communityId 
                 FROM community_posts cp 
                 JOIN communities c ON cp.communityId = c.id 
                 WHERE cp.id = ?`, 
                [communityPostId]
            );

            await db.promise().query("INSERT INTO likes (userId, communityPostId) VALUES(?, ?)", [userId, communityPostId]);
            
            // TRIGGER NOTIFICATION TO POST AUTHOR
            if (postDetails.length > 0 && postDetails[0].authorId !== userId) {
                const { authorId, communityTitle, communityId } = postDetails[0];
                await createNotification(
                    'COMMUNITY_POST_LIKE',
                    userId,
                    authorId,
                    { communityId, postId: communityPostId }, 
                    { communityTitle, senderUsername: req.user.username }
                );
            }

            likeCache.flushAll();
            return res.status(200).json({ message: "Post liked successfully." });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: "You have already liked this post." });
            }
            console.error("Like post error:", err);
            return res.status(500).json({ message: "Failed to like post", error: err.message });
        }
    });
};

// API TO GET LIKES FOR A COMMUNITY POST
export const getLikes = async (req, res) => {
    try {
        const communityPostId = parseInt(req.params.communityPostId);
        if (!Number.isInteger(communityPostId)) {
            return res.status(400).json({ message: "Invalid communityPostId" });
        }

        const cacheKey = `community_likes:${communityPostId}`;
        const cachedData = likeCache.get(cacheKey);
        if (cachedData) return res.status(200).json(cachedData);

        const q = "SELECT u.id, u.username, u.full_name, u.profilePic FROM likes AS l JOIN users AS u ON u.id = l.userId WHERE l.communityPostId = ?";
        const [rows] = await db.promise().query(q, [communityPostId]);
            
        const processedUsers = rows.map(user => {
            user.profilePic = processImageUrl(user.profilePic);
            return user;
        });

        likeCache.set(cacheKey, processedUsers);
        return res.status(200).json(processedUsers);
    } catch (err) {
        console.error("Error fetching likes:", err);
        return res.status(500).json({ message: "Failed to fetch likes", error: err.message });
    }
};

// API TO UNLIKE A COMMUNITY POST
export const unlike = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const communityPostId = parseInt(req.params.communityPostId);
            if (!Number.isInteger(communityPostId)) {
                return res.status(400).json({ message: "Invalid communityPostId" });
            }

            const q = "DELETE FROM likes WHERE communityPostId = ? AND userId = ?";
            const [result] = await db.promise().query(q, [communityPostId, userId]);
            
            if (result.affectedRows > 0) {
                likeCache.flushAll();
                return res.status(200).json({ message: "Post unliked successfully." });
            } else {
                return res.status(404).json({ message: "You have not liked this post." });
            }
        } catch (err) {
            console.error("Error unliking post:", err);
            return res.status(500).json({ message: "Failed to unlike post", error: err.message });
        }
    });
};