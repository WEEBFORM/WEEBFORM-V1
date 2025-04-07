import { executeQuery } from "../../middlewares/dbExecute";
import authenticateUser from "../../middlewares/verify.mjs";

export const reportPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = req.params.postId;
        const { reason } = req.body;

        if (!Number.isInteger(Number(postId))) {
            return res.status(400).json({ message: "Invalid post ID" });
        }

        if (!reason || reason.trim() === "") {
            return res.status(400).json({ message: "Reason is required" });
        }

        try {
            const q = "INSERT INTO reports (userId, postId, reason) VALUES (?, ?, ?)";
            await executeQuery(q, [userId, postId, reason]);
            return res.status(200).json({ message: "Post reported successfully" });
        } catch (err) {
            console.error("Failed to report post:", err);
            return res.status(500).json({ message: "Failed to report post", error: err });
        }
    });
};