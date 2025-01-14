import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl, decodeNestedKey } from "../../middlewares/S3bucketConfig.js";

// API TO CREATE NEW POST
export const newPost = async (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) { 
                return res.status(500).json({ message: "Unknown error", error: err });
            }
 
            const media = req.files["media"];
            const uploadedMediaUrls = [];

            if (media) {
                for (const file of media) {
                    try {
                        const params = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: `uploads/posts/${Date.now()}_${file.originalname}`,
                            Body: file.buffer,
                            ContentType: file.mimetype,
                        };
                        const command = new PutObjectCommand(params);
                        await s3.send(command);
                        uploadedMediaUrls.push(`https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`);
                    } catch (uploadError) {
                        console.error("Error uploading media:", uploadError);
                        return res.status(500).json({ message: "Error uploading media to S3", error: uploadError });
                    }
                }
            }

            const q = "INSERT INTO posts (`userId`, `description`, `media`, `tags`, `category`, `createdAt`) VALUES (?)";
            const values = [
                req.user.id,
                req.body.description,
                uploadedMediaUrls.join(","),
                req.body.tags,
                req.body.category,
                moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
            ];
            db.query(q, [values], (err, post) => {
                if (err) return res.status(500).json(err);
                else {
                    res.status(200).json({ message: "Post created successfully", post, values });
                }
            });
        });
    });
};

// API TO VIEW ALL POSTS
export const allPosts = async (req, res) => {
    authenticateUser(req, res, () => {
        const q = `
            SELECT 
                p.*, 
                u.id AS userId, 
                u.username, 
                u.full_name, 
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
        db.query(q, async (err, data) => {
            if (err) return res.status(500).json(err);
            const processedPosts = await Promise.all(
                data.map(async (post) => {
                    console.log("Processing post:", post);

                    if (post.media) {
                        const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                        try {
                            post.media = await Promise.all(mediaKeys.map(generateS3Url));
                        } catch (error) {
                            console.error("Error generating media URLs:", error);
                            post.media = null;
                        }
                    }
                    if (post.profilePic) {
                        const profileKey = s3KeyFromUrl(post.profilePic);
                        try {
                            post.profilePic = await generateS3Url(profileKey);
                        } catch (error) {
                            console.error("Error generating profilePic URL:", error);
                            post.profilePic = null;
                        }
                    }
                    return post;
                })
            );
            res.status(200).json(processedPosts);
        });
    });
};

// API TO VIEW POST IN USER PROFILE
export const userPosts = async (req, res) => {
    authenticateUser(req, res, () => {
        const userId = req.params.id;
        const q = `SELECT 
            p.*, 
            u.id AS userId, 
            u.username, 
            u.full_name, 
            u.profilePic, 
            COUNT(l.id) AS likesCount
        FROM 
            posts AS p
        JOIN 
            users AS u ON u.id = p.userId
        LEFT JOIN 
            likes AS l ON l.postId = p.id
        WHERE 
            u.id = ?
        GROUP BY 
            p.id, 
            u.id, 
            u.username, 
            u.full_name, 
            u.profilePic
        ORDER BY 
            p.createdAt DESC;`;
        db.query(q, [userId], async (err, data) => {
            if (err) {
                return res.status(500).json(err);
            }
            if (data.length === 0) {
                return res.status(404).json('No posts yet..');
            }
            const processedPosts = await Promise.all(
                data.map(async (post) => {
                    if (post.media) {
                        const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                        try {
                            post.media = await Promise.all(mediaKeys.map(generateS3Url));
                        } catch (error) {
                            console.error("Error generating media URLs:", error);
                            post.media = null;
                        }
                    }
                    if (post.profilePic) {
                        const profileKey = s3KeyFromUrl(post.profilePic);
                        try {
                            post.profilePic = await generateS3Url(profileKey);
                        } catch (error) {
                            console.error("Error generating profilePic URL:", error);
                            post.profilePic = null;
                        }
                    }
                    return post;
                })
            );
            res.status(200).json(processedPosts);
        });
    });
};

// API TO VIEW POSTS BASED ON FOLLOWING
export const followingPosts = async (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const q = "SELECT p.*, u.id AS userId, username, full_name, profilePic FROM posts AS p JOIN users AS u ON (u.id = p.userId) LEFT JOIN reach AS r ON (p.userId = r.followed) WHERE r.follower = ? OR p.userId = ? ORDER BY createdAt DESC";
        db.query(q, [user.id, user.id], async (err, data) => {
            if (err) {
                return res.status(500).json(err);
            } else {
                const processedPosts = await Promise.all(
                    data.map(async (post) => {
                        if (post.media) {
                            const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                            try {
                                post.media = await Promise.all(mediaKeys.map(generateS3Url));
                            } catch (error) {
                                console.error("Error generating media URLs:", error);
                                post.media = null;
                            }
                        }
                        if (post.profilePic) {
                            const profileKey = s3KeyFromUrl(post.profilePic);
                            try {
                                post.profilePic = await generateS3Url(profileKey);
                            } catch (error) {
                                console.error("Error generating profilePic URL:", error);
                                post.profilePic = null;
                            }
                        }
                        return post;
                    })
                );
                res.status(200).json(processedPosts);
            }
        });
    });
};

// API TO VIEW POST BASED ON CATEGORY
export const postCategory = (req, res) => {
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
        db.query(q, category, async (err, data) => {
            if (err) return res.status(500).json(err);
            if (data.length === 0) {
                return res.status(404).json("No posts found in this category.");
            }
            const processedPosts = await Promise.all(
                data.map(async (post) => {
                    if (post.media) {
                        const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                        try {
                            post.media = await Promise.all(mediaKeys.map(generateS3Url));
                        } catch (error) {
                            console.error("Error generating media URLs:", error);
                            post.media = null;
                        }
                    }
                    if (post.profilePic) {
                        const profileKey = s3KeyFromUrl(post.profilePic);
                        try {
                            post.profilePic = await generateS3Url(profileKey);
                        } catch (error) {
                            console.error("Error generating profilePic URL:", error);
                            post.profilePic = null;
                        }
                    }
                    return post;
                })
            );
            return res.status(200).json(processedPosts);
        });
    });
};

// API TO DELETE POST
export const deletePost = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const getPost = "SELECT media AS mediaUrl FROM posts WHERE id = ? AND userId = ?";
        db.query(getPost, [req.params.id, user.id], async (err, data) => {
            if (err) {
                return res.status(500).json({ message: "Database query error", error: err });
            }
            if (data.length === 0) {
                return res.status(404).json({ message: "Post not found!" });
            }
            const { mediaUrl } = data[0];
            const deleteS3Object = async (url) => {
                const key = s3KeyFromUrl(url);
                if (!key) {
                    console.error("Invalid S3 object URL:", url);
                    return null;
                }
                try {
                    const deleteCommand = new DeleteObjectCommand({
                        Bucket: process.env.BUCKET_NAME,
                        Key: key,
                    });
                    await s3.send(deleteCommand);
                    console.log("S3 object deleted successfully:", key);
                } catch (s3Error) {
                    console.error("Error deleting S3 object:", s3Error);
                    throw new Error("Error deleting file from S3");
                }
            };
            try {
                if (mediaUrl) {
                    const mediaUrls = mediaUrl.split(",");
                    for (const url of mediaUrls) {
                        await deleteS3Object(url);
                    }
                }
            } catch (deleteError) {
                return res.status(500).json({ message: "Error deleting S3 objects", error: deleteError });
            }
            const deletePostQuery = "DELETE FROM posts WHERE id = ? AND userId = ?";
            db.query(deletePostQuery, [req.params.id, user.id], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: "Database deletion error", error: err });
                }
                if (result.affectedRows > 0) {
                    return res.status(200).json({ message: "Post deleted successfully." });
                } else {
                    return res.status(403).json({ message: "You can only delete your own post." });
                }
            });
        });
    });
};

// RELEVANT FUNCTIONS
// FUNCTION TO SHUFFLE POSTS
const shufflePosts = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};
