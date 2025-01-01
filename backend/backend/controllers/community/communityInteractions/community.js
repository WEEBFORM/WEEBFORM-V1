import {db} from "../../../config/connectDB.js"
import {authenticateUser} from "../../../middlewares/verify.mjs"
import moment from "moment"
import {cpUpload} from "../../../middlewares/storage.js";
import multer from "multer";

//API TO CREATE NEW COMMUNITY
export const createCommunity = (req, res) => {
    // CHECK FOR JWT
    authenticateUser(req, res, () => {
        const user = req.user;
        cpUpload(req, res, function (err) {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }
            // CHECK FOR EXISTING COMMUNITY
            const check = "SELECT * FROM communities WHERE title = ?";
            const title = req.body.title;
            db.query(check, title, (err, data) =>{
                if (data && data.length){
                    return res.status(401).json('Community exists')
                }
            })
            //DP/LOGO UPLOAD
            const groupIcon = req.files['groupIcon'] ? req.files['groupIcon'][0].path : null;

            if (!groupIcon) {
                return res.status(400).send('Error uploading community Image');
            }
            const description = `Welcome to ${req.body.title}'s Official Community on Weebform.`
            // QUERY DB TO CREATE NEW COMMUNITY
            const q = "INSERT INTO communities (`creatorId`, `title`, `description`, `groupIcon`, `createdAt`) VALUES (?)";
            const values = [
                user.id,
                req.body.title,
                description,
                groupIcon,
                moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
            ];      
            db.query(q, [values], (err, data) => {
                if (err) return res.status(500).json(err);
            
                const communityId = data.insertId;
            
                //CREATE COMMUNITY GROUPS BY DEFAULT
                const groups = [
                    { title: "Announcements", communityId, groupIcon: "uploads/default group icons/announcements-icon.png" },
                    { title: "General Discussion", communityId, groupIcon: "uploads/default group icons/general-discussion-icon.png" },
                    { title: "Feed", communityId, groupIcon: "uploads/default group icons/feedback-icon.jpeg" }
                ];
            
                const insertGroups = "INSERT INTO `groups` (`title`, `communityId`, `groupIcon`, `createdAt`) VALUES ?";
                const groupValues = groups.map(group => [group.title, group.communityId, group.groupIcon, moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")]);
            
                db.query(insertGroups, [groupValues], (err) => {
                    if (err) {
                        console.error("Error creating groups:", err);
                        return res.status(500).json({ message: "Community created, but failed to create groups." });
                    }
                    res.status(200).json({ message: "Community and default groups successfully created." });
                });
            });            
        });
    });
};

// JOIN COMMUNITY
export const joinCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const comId = req.params.id;
        // VERIFY MEMBERSHIP
        const checkMembershipQuery = "SELECT * FROM members WHERE comId = ? AND memberId = ?";
        
        db.query(checkMembershipQuery, [comId, user.id], (err, results) => {
            if (err) {
                console.error("Error checking membership:", err);
                return res.status(500).json(err);
            }
            if (results.length > 0) {
                return res.status(409).json({ message: "You are already a member of this community." });
            }
            // QUERY DB TO INSERT INTO COMMUNITY MEMBERS TABLE
            const joinCommunityQuery = "INSERT INTO members (`comId`, `memberId`) VALUES (?, ?)";
        
            db.query(joinCommunityQuery, [comId, user.id], (err, data) => {
                if (err) {
                    return res.status(500).json(err);
                }
                const users = "SELECT u.username, c.title FROM members m JOIN users u ON m.memberId = u.id JOIN communities c ON m.comId = c.id;"
                db.query(users, (err, result) => {
                    if (err) {
                        return res.status(500).json("Server error");
                    }
                    if (result.length === 0) {
                        return res.status(404).json("User not found" );
                    }
                    const username = result[0].username;
                    const community = result[0].title;
                    return res.status(200).json(`${username} has joined the community: ${community}`);
                })
            }); 
        })
    });
};

//API TO VIEW JOINED COMMUNITIES
export const yourCommunities = (req, res) => {
    authenticateUser(req, res, () => {
        const userId = req.user.id;
        //QUERY DB TO GET POSTS
        const joined = "SELECT c.id, c.title, c.description, c.groupIcon, c.createdAt, cm.comId, cm.memberId FROM members cm JOIN communities c ON cm.comId = c.id WHERE cm.memberId = ?;"
        
        db.query(joined, [userId], (err, data) => {
            if (err) {
                return res.status(500).json(err);
            }if (data.lenght === 0){
                res.status(404).json("You haven't joined a community.. ")
            }
                return res.status(200).json(data);
        });
    });
};

//API TO VIEW ALL COMMUNITIES
export const communities = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO GET ALL EXISTING COMMUNITIES
        const q = "SELECT * FROM communities ORDER BY createdAt ASC";
        db.query(q, (err,data)=>{
        if(err) return res.status(500).json(err)
        //SHUFFLE COMMUNITIES
        const random = shuffleComs(data);
        return res.status(200).json(random)
        })
    }) 
}

// LEAVE COMMUNITY
export const exitCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;

        // Get the community ID from the request parameters
        const comId = req.params.id;

        // QUERY DB TO DELETE FROM MEMBERS TABLE
        const exit = "DELETE FROM `members` WHERE id = ? AND memberId = ?";

        db.query(exit, [comId, user.id], (err, data) => {
            if (err) {
                return res.status(500).json(err);
            }
            const users = "SELECT u.username, c.title FROM members m JOIN users u ON m.memberId = u.id JOIN communities c ON m.comId = c.id WHERE m.memberId = ? AND m.comId = ?";
            db.query(users, [user.id, comId], (err, result) => {
                if (err) {
                    return res.status(500).json(err);
                }
                if (result.length === 0) {
                    return res.status(404).json("Community not found");
                }
                const username = result[0].username;
                const community = result[0].title;
                return res.status(200).json(`${username} has left the community: ${community}`);
            });
        });
    });
};

//API TO DELETE COMMUNITY
export const deleteCommunity = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO DELETE COMMUNITY
        const q = "DELETE FROM communities WHERE id = ? AND creatorId = ?";
        db.query(q, [req.params.id, user.id], (err,data)=>{
        if(err) return res.status(500).json(err);
        if(data.affectedRows > 0){
            res.status(200).json("Community deleted succesfully")
        }else{
            return res.status(403).json('Community not found!')
        }
        })
    }) 
};

//RELEVANT FUNCTIONS
// FUNCTION TO SHUFFLE COMMUNITIES
const shuffleComs = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};