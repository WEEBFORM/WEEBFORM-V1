import { executeQuery } from "../../middlewares/dbExecute";
import { authenticateUser } from "../../middlewares/verify.mjs"

export const savePost = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = req.params.postId;

        if (!Number.isInteger(Number(postId))) {
            return res.status(400).json({ message: "Invalid post ID" });
        }

        try {
            const q = "INSERT INTO saved_posts (userId, postId) VALUES (?, ?)";
            await executeQuery(q, [userId, postId]);
            return res.status(200).json({ message: "Post saved successfully" });
        } catch (err) {
            console.error("Failed to save post:", err);
            return res.status(500).json({ message: "Failed to save post", error: err });
        }
    });
};

// API TO UNDO SAVE POST
export const unSavePost = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = req.params.postId;

        if (!Number.isInteger(Number(postId))) {
            return res.status(400).json({ message: "Invalid post ID" });
        }

        try {
            const q = "DELETE FROM saved_posts WHERE userId = ? AND postId = ?";
            await executeQuery(q, [userId, postId]);
            return res.status(200).json({ message: "Post unsaved successfully" });
        } catch (err) {
            console.error("Failed to unsave post:", err);
            return res.status(500).json({ message: "Failed to unsave post", error: err });
        }
    });
};

// API TO GET BLOCKED USERS
export const getSavedPosts = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        try {
            const q = "SELECT postId FROM saved_posts WHERE user_id = ?";
            const savedPosts = await executeQuery(q, [userId]);
            const savedPostIds = savedPosts.map(user => user.postId);

            return res.status(200).json(savedPostIds);
        } catch (err) {
            console.error("Get saved posts error:", err);
            return res.status(500).json({ message: "Failed to get saved posts", error: err.message });
        }
    });
};