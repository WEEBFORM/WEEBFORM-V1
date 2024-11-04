import {db} from "../../config/connectDB.js";
import {authenticateUser} from "../../middlewares/verify.mjs";
import {cpUpload} from "../../middlewares/storage.js";
import multer from "multer";
import bcrypt from "bcryptjs";

//API TO GET USER INFORMATION
export const viewProfile = (req, res)=>{
    //CHECK FOR JWT
    authenticateUser(req, res, () => {
        //const user = req.user;
        const userId = req.user.id;
        //QUERY DB TO GET USER INFO
        const q = `SELECT 
                    u.*, 
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM 
                    users AS u 
                    WHERE 
                    u.id = ?;`
        db.query(q, [userId], (err, data)=>{
        if(err){
            return res.status(500).json(err)
        }
        if(data.length === 0){ 
            return res.status(404).json("User not found");
        }
        const {coverPhoto, profilePic, password, ...userInfo} = data[0];
        let profileImage = profilePic 
        ? `data:image/jpeg;base64,${Buffer.from(profilePic).toString('base64')}` 
        : null;
        let coverImage = coverPhoto 
            ? `data:image/jpeg;base64,${Buffer.from(coverPhoto).toString('base64')}` 
            : null;

            return res.status(200).json({
                ...userInfo,
                profileImage,
                coverImage,
            });
        })
    });
}

//API TO GET ANOTHER USER'S INFORMATION
export const viewUserProfile = (req, res)=>{
    //CHECK FOR JWT
    authenticateUser(req, res, () => {
        //const user = req.user;
        const userId = req.params.id;
        const q = `SELECT 
                    u.*, 
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                    FROM 
                    users AS u 
                    WHERE 
                    u.id = ?;`
        db.query(q, [userId], (err, data)=>{
        if(err){
            return res.status(500).json(err)
        }
        if(data.length === 0){ 
            return res.status(404).json("User not found");
        }
        const {coverPhoto, profilePic, password, ...userInfo} = data[0];
        let profileImage = profilePic 
        ? `data:image/jpeg;base64,${Buffer.from(profilePic).toString('base64')}` 
        : null;
        let coverImage = coverPhoto 
            ? `data:image/jpeg;base64,${Buffer.from(coverPhoto).toString('base64')}` 
            : null;

        return res.status(200).json({
            ...userInfo,
            profileImage,
            coverImage,
        });
        })
    });
}
 
//API TO GET USERS
export const viewUsers = (req, res)=>{
    //CHECK FOR JWT
    authenticateUser(req, res, () => {
        //QUERY DB TO GET USERS
        const q = "SELECT * FROM users"
        db.query(q, (err, users)=>{
        if(err){
            return res.status(500).json(err)
        }
        if (users.length === 0) {
            return res.status(404).json("No users found");
        }
        return res.status(200).json(users)
        })
    });
}

//API TO EDIT USER INFO
export const editProfile = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO EDIT USER INFO
        cpUpload(req, res, function (err) {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }

            // HASH PASSWORD
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(req.body.password, salt);

            // HANDLE FILE UPLOAD
            const profilePic = req.files['profilePic'] ? req.files['profilePic'][0].path : null;
            const coverPhoto = req.files['coverPhoto'] ? req.files['coverPhoto'][0].path : null;

            if (!profilePic || !coverPhoto) {
                return res.status(400).send('Files were not uploaded correctly.');
            }

            const q = "UPDATE users SET email = ?, full_name =?, username = ?, nationality = ?, password = ?, coverPhoto = ?, profilePic = ?, bio = ? WHERE id = ?";
            const values = [
               req.body.email,
               req.body.fullName,
               req.body.username,  
               req.body.nationality,
               hashedPassword,
               coverPhoto,
               profilePic,
               req.body.bio,
               user.id
            ]; 
            db.query(q, values, (err,data)=>{
            if(err){
               return res.status(500).json(err)
            }
            else{
                res.status(200).json("Account updated successfully")
            }
            })
        })

    }) 
}

//API TO DELETE ACCOUNT 
export const deleteAccount = (req, res)=>{ 
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO EDIT USER INFO
        const q = "DELETE FROM users WHERE id = ?"
        db.query(q, user.id, (err, data)=>{ 
            if(err){
                return res.status(500).json(err)
            }
            if(data.length === 0){
                return res.status(404).json("User not found");
            }
            res.clearCookie("accessToken",{
                secure: true,
                sameSite: "none"
            })
            return res.status(200).json(`Account has been deleted successfully`)
        })  
    }) 
}
