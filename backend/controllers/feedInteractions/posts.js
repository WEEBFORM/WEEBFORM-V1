import {db} from "../../config/connectDB.js"
import {authenticateUser} from "../../middlewares/verify.mjs"
import moment from "moment"
import {cpUpload} from "../../middlewares/storage.js";
import multer from "multer";

// API TO CREATE NEW POST
export const newPost = (req, res) => {
    // CHECK FOR JWT
    authenticateUser(req, res, () => {
        const user = req.user;
        cpUpload(req, res, function (err) {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }

            // HANDLE FILE UPLOAD
            const images = req.files['image'] ? req.files['image'].map(file => file.path) : [];
            const videos = req.files['video'] ? req.files['video'].map(file => file.path) : [];

            if (images.length === 0 && videos.length === 0) {
                return res.status(400).send('Files were not uploaded correctly.');
            }

            // CONVERT MEDIA ARRAY TO COMMA SEPERATED STRINGS TO STORE IN THE DB
            const image = images.join(',');
            const video = videos.join(',');

            // QUERY DB TO CREATE POST
            const q = "INSERT INTO posts (`userId`, `description`, `image`, `video`, `tags`, `category`, `createdAt`) VALUES (?)";
            const values = [
                user.id,
                req.body.description, 
                image,
                video,
                req.body.tags,
                req.body.category,
                moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
            ];      
            db.query(q, [values], (err, data) => {
                if (err) return res.status(500).json(err);
                res.status(200).json("Post created successfully");
            });
        });
    });
};


//API TO VIEW POST IN USER PROFILE
export const userPosts = (req, res) => {
    authenticateUser(req, res, () => {
        const userId = req.params.id;
        
        const q = "SELECT p.*, u.id AS userId, username, full_name, profilePic FROM posts AS p LEFT JOIN users AS u ON (u.id = p.userId) WHERE userId = ? ORDER BY createdAt DESC";
        db.query(q, [userId], (err, data) => {
            if (err) {
                return res.status(500).json(err);
            }
            if (data.length === 0) {
                return res.status(404).json('No posts yet..'); 
            }
            const processedPosts = data.map(post => {
                if (post.image) {
                    post.image = `${req.protocol}://${req.get('host')}/${post.image}`;
                }
                if (post.video) {
                    post.video = `${req.protocol}://${req.get('host')}/${post.video}`;
                }
                if (post.profilePic) {
                    post.profilePic = `${req.protocol}://${req.get('host')}/${post.profilePic}`;
                }
                return post;
            });
            return res.status(200).json(processedPosts);
        });
    });
};


//API TO VIEW POSTS BASED ON FOLLOWING
export const followingPosts = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const q = "SELECT p.*, u.id AS userId, username, full_name, profilePic FROM posts AS p JOIN users AS u ON (u.id = p.userId) LEFT JOIN reach AS r ON (p.userId = r.followed) WHERE r.follower = ? OR p.userId = ? ORDER BY createdAt DESC";
        db.query(q, [user.id, user.id], (err,data)=>{
        if(err) {
            return res.status(500).json(err)
        }else{
            const processedPosts = data.map(post => {
                if (post.image) {
                    post.image = `${req.protocol}://${req.get('host')}/${post.image}`;
                }
                if (post.video) {
                    post.video = `${req.protocol}://${req.get('host')}/${post.video}`;
                }
                if (post.profilePic) {
                    post.profilePic = `${req.protocol}://${req.get('host')}/${post.profilePic}`;
                }
                return post;
            });
            return res.status(200).json(processedPosts);
        }
        })
    }) 
}

// API TO VIEW ALL POSTS
export const allPosts = (req, res) => {
    authenticateUser(req, res, () => {
      const user = req.user;
      const q = `
        SELECT 
          p.*, 
          u.id AS userId, 
          u.username,
          full_name, 
          u.profilePic, 
          COUNT(l.id) AS likesCount
        FROM 
          posts AS p 
        JOIN 
          users AS u ON u.id = p.userId 
        LEFT JOIN 
          likes AS l ON l.postId = p.id
        GROUP BY 
          p.id, u.id
        ORDER BY 
          p.createdAt DESC
      `;
  
      db.query(q, (err, data) => {
        if (err) return res.status(500).json(err);
        const processedPosts = data.map(post => {
            if (post.image) {
                post.image = `${req.protocol}://${req.get('host')}/${post.image}`;
            }
            if (post.video) {
                post.video = `${req.protocol}://${req.get('host')}/${post.video}`;
            }
            if (post.profilePic) {
                post.profilePic = `${req.protocol}://${req.get('host')}/${post.profilePic}`;
            }
            return post;
        });
        const shuffledPosts = shufflePosts(processedPosts);
        return res.status(200).json(shuffledPosts);
    });
});
};

//API TO VIEW POST BASED ON CATEGORY
export const postCategory = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        const q = `SELECT 
          p.*, 
          u.id AS userId, 
          u.username,
          full_name, 
          u.profilePic, 
          COUNT(l.id) AS likesCount
        FROM 
          posts AS p 
        JOIN 
          users AS u ON u.id = p.userId 
        LEFT JOIN 
          likes AS l ON l.postId = p.id
         WHERE 
            p.category = ? 
        GROUP BY 
            p.id, u.id 
        ORDER BY 
            createdAt DESC`;
        const category = req.params.category;
        db.query(q, category, (err,data)=>{
        if(err) return res.status(500).json(err)
        if (data.length === 0) {
            return res.status(404).json("No posts found in this category.");
        }
        const processedPosts = data.map(post => {
            if (post.image) {
                post.image = `${req.protocol}://${req.get('host')}/${post.image}`;
            }
            if (post.video) {
                post.video = `${req.protocol}://${req.get('host')}/${post.video}`;
            }
            if (post.profilePic) {
                post.profilePic = `${req.protocol}://${req.get('host')}/${post.profilePic}`;
            }
            return post;
        });

        return res.status(200).json(processedPosts);
        })
    }) 
}

//API TO DELETE POST
export const deletePost = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        
        const q = "DELETE FROM posts WHERE id = ? AND userId = ?";

        db.query(q, [req.params.id, user.id], (err,data)=>{
        if(err) return res.status(500).json(err);
        if(data.affectedRows > 0){
            res.status(200).json("Post deleted succesfully")
        }else{
            return res.status(403).json('You can only delete your post')
        }
        })
    }) 
}

//RELEVANT FUNCTIONS

// FUNCTION TO SHUFFLE POSTS
const shufflePosts = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};