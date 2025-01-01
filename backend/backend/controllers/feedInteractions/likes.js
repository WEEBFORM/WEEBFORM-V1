import {db} from "../../config/connectDB.js"
import {authenticateUser} from "../../middlewares/verify.mjs"

//API TO LIKE POST
export const like = (req, res)=>{
    //CHECK FOR JWT
    authenticateUser(req, res, () => {
        const user = req.user;
        const postId = parseInt(req.params.postId);
       //QUERY DB TO LIKE POST
        const q = "INSERT INTO likes (userId, postId) VALUES(?, ?)"
        const values = [ 
            user.id,
            postId
        ]
        db.query(q, values, (err, data)=>{
        if(err) {
            return res.status(500).json(err)
        }
        return res.status(200).json("liked post")
        })
    });

}

//API TO GET LIKES
export const getLikes = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const postId = parseInt(req.params.postId);
        //QUERY DB TO GET LIKES
        const q = "SELECT l.userId FROM likes AS l WHERE l.postId = ? ";

        db.query(q, [postId], (err,data)=>{
        if(err) return res.status(500).json(err)
        if (data && data.length > 0) {
            const userId = data.map(obj => Number(obj.userId));
            return res.status(200).json(userId);
        } else {
            return res.status(200).json([]);
        }
        })
    }) 
}

//API TO UNLIKE POST
export const unlike = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const postId = req.params.postId;
        if (!postId) {
            return res.status(404).json("post does not exist");
        }
        //QUERY DB TO UNLIKE POST
        const q = "DELETE FROM likes WHERE postId = ? AND userId = ? ";
        const values = [
            postId, 
            user.id
        ]
        db.query(q, values, (err, data)=>{
            if (err) {
                return res.status(500).json(err);
            }
            const userId = req.body.followed
                return res.status(200).json({ message: `Unliked post`});
       })
    }) 
}