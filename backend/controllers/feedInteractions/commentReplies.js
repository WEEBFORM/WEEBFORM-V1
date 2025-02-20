// backend/controllers/commentReplies.js
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import NodeCache from 'node-cache';

const replyCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache for 5 minutes

//API TO REPLY A COMMENT
export const replyComment = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const commentId = req.params.commentId
        //QUERY DB TO COMMENT ON POST
        const q = "INSERT INTO replies (`commentId`, `userId`, `reply`,`gifs`,`createdAt`) VALUES (?)";
        const values =[
            commentId,
            user.id,
            req.body.reply,
            req.body.gifs,
            moment(Date.now()).format("YYYY-MM-DD HH:MM:SS")
        ]
        db.query(q, [values], (err,data)=>{
        if(err){
            return res.status(500).json(err)
        }
        else{
            // Invalidate cache for this comment's replies
            replyCache.del(`replies:${commentId}`);
            res.status(200).json("reply added successfully")
        }
        })
    });
}

//API TO VIEW REPLIES (with caching)
export const viewReply = (req, res)=>{
    authenticateUser(req, res, () => {
        const commentId = req.params.commentId;

        // Check if replies are cached
        const cachedReplies = replyCache.get(`replies:${commentId}`);
        if (cachedReplies) {
            console.log("Serving replies from cache");
            return res.status(200).json(cachedReplies);
        }
        const q = "SELECT r.*, u.id AS userId, username, full_name, profilePic FROM replies AS r JOIN users AS u ON (u.id = r.userId) JOIN comments AS c ON (c.id = r.commentId) WHERE r.commentId = ?";
        db.query(q, commentId, (err,data)=>{
        if(err) return res.status(500).json(err)
          // Cache the replies
          replyCache.set(`replies:${commentId}`, data);
          console.log("Serving replies from database and caching");
          res.status(200).json(data)
        })
    })
}

//API TO DELETE A REPLY
export const deleteReply = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const replyId = req.params.replyId
        //QUERY DB TO DELETE REPLY
        const q = "DELETE FROM replies WHERE id = ? AND userId = ?";
        db.query(q, [replyId, user.id], (err,data)=>{
        if(err) {
            return res.status(500).json(err)
        }
        if(data){
          // Invalidate the cache for the associated comment
          const getCommentIdQuery = "SELECT commentId FROM replies WHERE id = ?";
          db.query(getCommentIdQuery, [replyId], (err, result) => {
              if (err) {
                  console.error("Error getting commentId:", err);
                  return res.status(500).json(err);
              }
              if (result.length > 0) {
                  replyCache.del(`replies:${result[0].commentId}`);
              }
              res.status(200).json("Reply deleted successfully");
          });
        }else{
            res.status(409).json("Can only delete your reply")
        }
        })
    })
}