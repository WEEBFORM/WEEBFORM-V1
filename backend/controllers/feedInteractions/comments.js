import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import NodeCache from 'node-cache';

const commentCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache for 5 minutes

//API TO CREATE NEW COMMENT
export const addComment = (req, res) => {
  authenticateUser(req, res, () => {
    const user = req.user;
    const postId = req.params.postId;
    const q =
      "INSERT INTO comments (`desc`, `gifs`,`userId`,`postId`,`createdAt`) VALUES (?)";
    const values = [
      req.body.desc,
      req.body.gifs, 
      user.id,
      postId,
      moment(Date.now()).format("YYYY-MM-DD HH:MM:SS"),
    ];

    db.query(q, [values], (err, data) => {
      if (err) return res.status(500).json(err);
      commentCache.del(`comments:${postId}`);
      res.status(200).json("commented successfully");
    });
  });
};

//API TO VIEW COMMENTS (with caching)
export const getComment = (req, res) => {
  authenticateUser(req, res, () => {
    const postId = req.params.postId;
    const cachedComments = commentCache.get(`comments:${postId}`);
    if (cachedComments) {
      console.log("Serving comments from cache");
      return res.status(200).json(cachedComments);
    }

    const q = `
      SELECT 
          c.*, 
          u.id AS userId, 
          username, 
          full_name, 
          profilePic,
          (SELECT COUNT(*) FROM replies WHERE commentId = c.id) AS replyCount
      FROM comments AS c
      JOIN users AS u ON (u.id = c.userId)
      WHERE c.postId = ?
      ORDER BY c.createdAt DESC
    `;

    db.query(q, postId, (err, data) => {
      if (err) return res.status(500).json(err);

      commentCache.set(`comments:${postId}`, data);
      console.log("Serving comments from database and caching");
      return res.status(200).json(data);
    });
  });
};

//API TO DELETE COMMENT
export const deleteComment = (req, res) => {
  authenticateUser(req, res, () => {
    const user = req.user;
    const commentId = req.params.commentId;
    const q = "DELETE FROM comments WHERE id = ? AND userId = ?";

    db.query(q, [commentId, user.id], (err, data) => {
      if (err) return res.status(500).json(err);
      if (data.affectedRows > 0) {
        const getPostIdQuery = "SELECT postId FROM comments WHERE id = ?";
        db.query(getPostIdQuery, [commentId], (err, result) => {
          if (err) {
            console.error("Error getting postId:", err);
            return res.status(500).json(err);
          }
          if (result.length > 0) {
            commentCache.del(`comments:${result[0].postId}`);
          }
          res.status(200).json("Comment deleted successfully");
        });
      } else {
        res
          .status(403)
          .json("Can only delete your own comment"); 
      }
    });
  });
};