import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import NodeCache from 'node-cache';
import { processImageUrl } from '../../middlewares/cloudfrontConfig.js';
import { createNotification } from "../notificationsController.js";

const commentCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const replyCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// HELPER TO FETCH PROFILE PICS
const processItems = (items) => {
    if (!items || items.length === 0) {
        return [];
    }
    return items.map(item => {
        if (item.profilePic) {
            item.profilePic = processImageUrl(item.profilePic);
        }
        return item;
    });
};


// COMMENTS
export const addComment = async (req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const userId = req.user.id;
      const postId = req.params.postId;
      const { desc, gifs } = req.body;

      const q =
        "INSERT INTO comments (`desc`, `gifs`, `userId`, `postId`, `createdAt`) VALUES (?, ?, ?, ?, ?)";
      const values = [
        desc,
        gifs,
        userId,
        postId,
        moment().format("YYYY-MM-DD HH:mm:ss"),
      ];

      const [result] = await db.promise().query(q, values);
      commentCache.del(`comments:${postId}`);

      // Create notification for post author
      const [post] = await db
        .promise()
        .query("SELECT userId FROM posts WHERE id = ?", [postId]);
      if (post.length > 0) {
        await createNotification(
          "COMMENT_ON_POST",
          userId,
          post[0].userId,
          postId,
          result.insertId
        );
      }

      // Create notifications for mentioned users
      const mentionedUsers = desc.match(/@(\w+)/g);
      if (mentionedUsers) {
        for (const mention of mentionedUsers) {
          const username = mention.substring(1);
          const [user] = await db
            .promise()
            .query("SELECT id FROM users WHERE username = ?", [username]);
          if (user.length > 0) {
            await createNotification(
              "COMMENT_MENTION",
              userId,
              user[0].id,
              postId,
              result.insertId
            );
          }
        }
      }

      res.status(200).json({ message: "Comment added successfully." });
    } catch (err) {
      console.error("Error adding comment:", err);
      res
        .status(500)
        .json({ message: "Failed to add comment.", error: err.message });
    }
  });
};


export const getComments = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const postId = req.params.postId;
            const cacheKey = `comments:${postId}`;
    
            const cachedData = commentCache.get(cacheKey);
            if (cachedData) return res.status(200).json(cachedData);
    
            const q = `
              SELECT c.*, u.id AS userId, u.username, u.full_name, u.profilePic,
                     (SELECT COUNT(*) FROM replies WHERE commentId = c.id) AS replyCount
              FROM comments AS c
              JOIN users AS u ON u.id = c.userId
              WHERE c.postId = ?
              ORDER BY c.createdAt DESC;
            `;
    
            const [comments] = await db.promise().query(q, [postId]);
            const processedComments = processItems(comments);
    
            commentCache.set(cacheKey, processedComments);
            return res.status(200).json(processedComments);
        } catch (err) {
            console.error("Error fetching comments:", err);
            res.status(500).json({ message: "Failed to fetch comments.", error: err.message });
        }
    });
};

export const deleteComment = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const commentId = req.params.commentId;
    
            const [commentData] = await db.promise().query("SELECT postId FROM comments WHERE id = ?", [commentId]);
            if (commentData.length === 0) return res.status(404).json({ message: "Comment not found." });
            
            const { postId } = commentData[0];
            const q = "DELETE FROM comments WHERE id = ? AND userId = ?";
            const [result] = await db.promise().query(q, [commentId, userId]);
    
            if (result.affectedRows > 0) {
                commentCache.del(`comments:${postId}`);
                replyCache.del(`replies:${commentId}`);
                res.status(200).json({ message: "Comment deleted successfully." });
            } else {
                res.status(403).json({ message: "You can only delete your own comment." });
            }
        } catch (err) {
            console.error("Error deleting comment:", err);
            res.status(500).json({ message: "Failed to delete comment.", error: err.message });
        }
    });
};


// ======== REPLIES (NESTED) ========

export const addReply = async (req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const userId = req.user.id;
      const { reply, gifs, commentId, parentReplyId } = req.body;

      if (!commentId) {
        return res
          .status(400)
          .json({ message: "A parent commentId is required for all replies." });
      }

      const q =
        "INSERT INTO replies (`commentId`, `userId`, `reply`, `gifs`, `parentReplyId`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)";
      const values = [
        commentId,
        userId,
        reply,
        gifs,
        parentReplyId || null,
        moment().format("YYYY-MM-DD HH:mm:ss"),
      ];

      const [result] = await db.promise().query(q, values);
      replyCache.del(`replies:${commentId}`);

      // Create notification for comment author or parent reply author
      if (parentReplyId) {
        const [parentReply] = await db
          .promise()
          .query("SELECT userId FROM replies WHERE id = ?", [parentReplyId]);
        if (parentReply.length > 0) {
          await createNotification(
            "REPLY_TO_REPLY",
            userId,
            parentReply[0].userId,
            null,
            commentId,
            result.insertId
          );
        }
      } else {
        const [comment] = await db
          .promise()
          .query("SELECT userId FROM comments WHERE id = ?", [commentId]);
        if (comment.length > 0) {
          await createNotification(
            "REPLY_TO_COMMENT",
            userId,
            comment[0].userId,
            null,
            commentId,
            result.insertId
          );
        }
      }

      // Create notifications for mentioned users
      const mentionedUsers = reply.match(/@(\w+)/g);
      if (mentionedUsers) {
        for (const mention of mentionedUsers) {
          const username = mention.substring(1);
          const [user] = await db
            .promise()
            .query("SELECT id FROM users WHERE username = ?", [username]);
          if (user.length > 0) {
            await createNotification(
              "COMMENT_MENTION",
              userId,
              user[0].id,
              null,
              commentId,
              result.insertId
            );
          }
        }
      }

      res.status(200).json({ message: "Reply added successfully." });
    } catch (err) {
      console.error("Error adding reply:", err);
      res
        .status(500)
        .json({ message: "Failed to add reply.", error: err.message });
    }
  });
};

export const getReplies = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const commentId = req.params.commentId;
            const cacheKey = `replies:${commentId}`;
    
            const cachedData = replyCache.get(cacheKey);
            if (cachedData) return res.status(200).json(cachedData);
    
            const q = `
                SELECT r.*, u.id AS userId, u.username, u.full_name, u.profilePic
                FROM replies AS r
                JOIN users AS u ON u.id = r.userId
                WHERE r.commentId = ?
                ORDER BY r.createdAt ASC;
            `;
     
            const [replies] = await db.promise().query(q, [commentId]);
            const processedReplies = processItems(replies);
    
            replyCache.set(cacheKey, processedReplies);
            res.status(200).json(processedReplies);
        } catch (err) {
            console.error("Error fetching replies:", err);
            res.status(500).json({ message: "Failed to fetch replies.", error: err.message });
        }
    });
};

export const deleteReply = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const replyId = req.params.replyId;
    
            const [replyData] = await db.promise().query("SELECT commentId FROM replies WHERE id = ?", [replyId]);
            if (replyData.length === 0) return res.status(404).json({ message: "Reply not found." });
            
            const { commentId } = replyData[0];
            const q = "DELETE FROM replies WHERE id = ? AND userId = ?";
            const [result] = await db.promise().query(q, [replyId, userId]);
    
            if (result.affectedRows > 0) {
                replyCache.del(`replies:${commentId}`);
                res.status(200).json({ message: "Reply deleted successfully." });
            } else {
                res.status(403).json({ message: "You can only delete your own reply." });
            }
        } catch (err) {
            console.error("Error deleting reply:", err);
            res.status(500).json({ message: "Failed to delete reply.", error: err.message });
        }
    });
};


// ======== USER'S ACTIVITY ========

export const getUserComments = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.params.userId;
            const q = `
              SELECT c.id, c.desc, c.createdAt, p.id AS postId,
                     p.description AS postDescription, author.id AS postAuthorId,
                     author.username AS postAuthorUsername
              FROM comments AS c
              JOIN posts AS p ON c.postId = p.id
              JOIN users AS author ON p.userId = author.id
              WHERE c.userId = ?
              ORDER BY c.createdAt DESC;
            `;
            
            const [comments] = await db.promise().query(q, [userId]);
            res.status(200).json(comments);
        } catch (err) {
            console.error(`Error fetching comments for user ${userId}:`, err);
            res.status(500).json({ message: "Failed to fetch user comments.", error: err.message });
        }
    });
};
