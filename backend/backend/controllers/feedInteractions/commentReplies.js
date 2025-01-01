import {db} from "../../config/connectDB.js"
import {authenticateUser} from "../../middlewares/verify.mjs"
import moment from "moment"


//API TO REPLY A COMMENT
export const replyComment = (req, res)=>{
    //CHECK FOR JWT
    authenticateUser(req, res, () => {
        const user = req.user;
        const commentId = req.params.commentId
        //QUERY DB TO COMMENT ON POST
        const q = "INSERT INTO replies (`commentId`, `userId`, `reply`,`gifs`,`createdAt`) VALUES (?)"
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
            res.status(200).json("reply added successfully")
        }
        })
    });
}

//API TO VIEW REPLIES
export const viewReply = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const commentId = req.params.commentId
        //QUERY DB TO GET COMMENTS
        const q = "SELECT r.*, u.id AS userId, username, profilePic FROM replies AS r JOIN users AS u ON (u.id = r.userId) JOIN comments AS c ON (c.id = r.commentId) WHERE r.commentId = ?";
        db.query(q, commentId, (err,data)=>{
        if(err) return res.status(500).json(err)
        res.status(200).json(data)
        })
    }) 
}

//API TO DELETE COMMENT
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
            res.status(200).json("Reply deleted succesfully")
        }else{
            res.status(409).json("Can only delete your reply")
        }
        })
    }) 
}