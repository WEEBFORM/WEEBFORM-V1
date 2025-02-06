import {db} from "../../config/connectDB.js"
import {authenticateUser} from "../../middlewares/verify.mjs"

//API TO FOLLOW USER
export const followUser = (req, res)=>{
    //CHECK FOR JWT
    authenticateUser(req, res, () => {
        const user = req.user;
        const followed = parseInt(req.params.followed);
        if (!followed) {
            return res.status(400).json("Missing followed user ID");
        }
        if(followed === user.id) {
            return res.status(409).json("Cannot follow yourself");
        }
        // QUERY DB TO CHECK IF USER ALREADY FOLLOWED
        const q = "SELECT * FROM reach WHERE followed = ? AND follower = ?";
        const checkValues = [followed, user.id];
        db.query(q, checkValues, (err, data) => {
        if (err) {
            return res.status(500).json(err);
            }
            if (data.length > 0) {
            return res.status(409).json("You are already following this user");
            }
           //QUERY DB TO FOLLOW USER
            const q = "INSERT INTO reach (followed, follower) VALUES(?, ?)"
            const values = [
                followed, 
                user.id
            ]
            db.query(q, values, (err,data)=>{
            if(err) {
                return res.status(500).json(err)
            }
            if(data.length === 0){
                return res.status(404).json("User does not exist");
            }
            return res.status(200).json("Following user")
            })
        });
    });
}

//API TO GET FOLLOWERS
export const getFollowers = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO GET FOLOWERS
        const q = "SELECT r.follower FROM reach AS r WHERE r.followed = ? ";

        db.query(q, [user.id], (err,data)=>{
        if(err) return res.status(500).json(err)
        if (data && data.length > 0) {
            const follower = data.map(obj => Number(obj.follower));
            return res.status(200).json(follower);
        } else {
            return res.status(200).json([]);
        }
        })
    }) 
}

//API TO GET FOLLOWING
export const getFollowing = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO GET FOLLOWING USERS
        const q = "SELECT r.followed FROM reach AS r WHERE r.follower = ? ";
        db.query(q, user.id, (err,data)=>{
        if(err) return res.status(500).json(err)
        if (data && data.length > 0) {
            const followed = data.map(obj => Number(obj.followed));
            return res.status(200).json(followed);
        }else{
            res.status(404).json(
                'Not following anyone yet'
            )
        }
        })
    }) 
}

//API TO UNFOLLOW USERS
export const unfollowUser = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const followed = req.params.followed;
        if (!followed) {
            return res.status(400).json("Missing followed user ID");
        }
        //QUERY DB TO REMOVE FROM FOLLOWERS
        const q = "DELETE FROM reach WHERE followed = ? AND follower = ? ";
        const values = [
            followed, 
            user.id
        ]
        db.query(q, values, (err, data)=>{
            if (err) {
                return res.status(500).json(err);
            }
            const userId = req.body.followed
                return res.status(200).json({ message: `Unfollowed user${followed}` });
       })
    }) 
}