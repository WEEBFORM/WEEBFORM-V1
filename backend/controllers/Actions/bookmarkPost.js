import { executeQuery } from "../../middlewares/dbExecute.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import { fetchAndProcessPostDetails } from "../feedInteractions/posts.js";

//BOOKMARK A POST
export const bookmarkPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = req.params.postId;

        if (!Number.isInteger(Number(postId))) {
            return res.status(400).json({ message: "Invalid post ID" });
        }

        try {
            // CHECK IF ALREADY BOOKMARKED
            const checkQuery = "SELECT id FROM bookmarked_posts WHERE userId = ? AND postId = ?";
            const [existing] = await executeQuery(checkQuery, [userId, postId]);

            if (existing) {
                return res.status(409).json({ message: "Post is already bookmarked." });
            }

            // IF NOT BOOKMARKED, INSERT NEW RECORD
            const insertQuery = "INSERT INTO bookmarked_posts (userId, postId) VALUES (?, ?)";
            await executeQuery(insertQuery, [userId, postId]);
            
            return res.status(200).json({ message: "Post bookmarked successfully" });

        } catch (err) {
            console.error("Failed to bookmark post:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: "Post is already bookmarked." });
            }
            return res.status(500).json({ message: "Failed to bookmark post", error: err });
        }
    });
};

//REMOVE BOOKMARK FROM A POST
export const unBookmarkPost = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const postId = req.params.postId;

        if (!Number.isInteger(Number(postId))) {
            return res.status(400).json({ message: "Invalid post ID" });
        }

        try {
            const deleteQuery = "DELETE FROM bookmarked_posts WHERE userId = ? AND postId = ?";
            const result = await executeQuery(deleteQuery, [userId, postId]);

            if (result.affectedRows === 0) {
                 return res.status(404).json({ message: "Bookmark not found." });
            }

            return res.status(200).json({ message: "Post removed from bookmarks successfully" });
        } catch (err) {
            console.error("Failed to remove bookmark:", err);
            return res.status(500).json({ message: "Failed to remove bookmark", error: err });
        }
    });
};

//GET ALL BOOKMARKED POSTS FOR AUTHENTICATED USER
export const getBookmarkedPosts = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        try {
            // GET ALL BOOKMARKED POST IDS FOR THE USER
            const q = "SELECT postId FROM bookmarked_posts WHERE userId = ? ORDER BY createdAt DESC";
            const bookmarkedRows = await executeQuery(q, [userId]);
            
            if (bookmarkedRows.length === 0) {
                return res.status(200).json([]);
            }

            const bookmarkedPostIds = bookmarkedRows.map(row => row.postId);

            //USE THE REUSABLE FUNCTION TO FETCH DETAILED POST INFO
            const posts = await fetchAndProcessPostDetails(bookmarkedPostIds, userId);
            
            const postsById = new Map(posts.map(p => [p.id, p]));
            const sortedPosts = bookmarkedPostIds.map(id => postsById.get(id)).filter(Boolean);

            return res.status(200).json(sortedPosts);

        } catch (err) {
            console.error("Get bookmarked posts error:", err);
            return res.status(500).json({ message: "Failed to get bookmarked posts", error: err.message });
        }
    });
};