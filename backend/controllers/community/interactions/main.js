import { db } from "../../../config/connectDB.js";
import { authenticateUser } from "../../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../../middlewares/storage.js";
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl, deleteS3Object } from "../../../middlewares/S3bucketConfig.js";

// CREATE NEW POST for Community Feed
export const newCommunityPost = async (req, res) => {
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

            const communityId = req.params.id;
            const membershipCheckQuery = `
                SELECT COUNT(*) AS isMember 
                FROM community_members
                WHERE userId = ? AND communityId = ?
            `;
            db.query(membershipCheckQuery, [req.user.id, communityId], (err, result) => {
                if (err) {
                    console.error("Error checking membership for new post:", err);
                    return res.status(500).json({ message: "Database error", error: err });
                }

                if (result[0].isMember === 0) {
                    return res.status(403).json({ message: "You must be a member of this community to post in its feed." });
                }

                // INSERT POST INTO communityposts TABLE
                const insertPostQuery = `
                    INSERT INTO communityposts 
                    (\`userId\`, \`communityId\`, \`description\`, \`media\`, \`category\`, \`createdAt\`) 
                    VALUES (?)
                `;
                const values = [
                    req.user.id,
                    communityId,
                    req.body.description,
                    uploadedMediaUrls.join(","),
                    req.body.category,
                    moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
                ];
                db.query(insertPostQuery, [values], (err, post) => {
                    if (err) {
                        console.error("Error creating community post:", err);
                        return res.status(500).json({ message: "Database error", error: err });
                    }
                    res.status(200).json({ message: "Post created successfully", post });
                });
            });
        });
    });
};


// API TO VIEW COMMUNITY POSTS
export const fetchCommunityPosts = async (req, res) => {
    authenticateUser(req, res, () => {
        const communityId = req.params.id;

        if (!communityId) {
            return res.status(400).json({ message: "Community ID is required." });
        }
        const q = `
            SELECT 
                cp.*, 
                u.id AS userId, 
                u.username, 
                u.full_name, 
                u.profilePic, 
                COUNT(l.id) AS likesCount
            FROM 
                communityposts AS cp
            JOIN 
                users AS u ON u.id = cp.userId
            LEFT JOIN 
                likes AS l ON l.postId = cp.id
            WHERE 
                cp.communityId = ?
            GROUP BY 
                cp.id, u.id
            ORDER BY 
                cp.createdAt DESC
        `;

        db.query(q, [communityId], async (err, data) => {
            if (err) {
                console.error("Error fetching community posts:", err);
                return res.status(500).json({ message: "Database error", error: err });
            }

            const processedPosts = await Promise.all(
                data.map(async (post) => {
                    if (post.media) {
                        const mediaKeys = post.media.split(",").map(s3KeyFromUrl);
                        try {
                            post.media = await Promise.all(mediaKeys.map(generateS3Url));
                        } catch (error) {
                            console.error("Error generating media URLs for post:", error);
                            post.media = null;
                        }
                    }
                    if (post.profilePic) {
                        const profileKey = s3KeyFromUrl(post.profilePic);
                        try {
                            post.profilePic = await generateS3Url(profileKey);
                        } catch (error) {
                            console.error("Error generating profilePic URL for post:", error);
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


// API TO DELETE COMMUNITY POST
export const deleteCommunityPost = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const postId = req.params.id;

        const getPost = "SELECT media AS mediaUrl FROM communityposts WHERE id = ? AND userId = ?";
        db.query(getPost, [postId, user.id], async (err, data) => {
            if (err) {
                return res.status(500).json({ message: "Database query error", error: err });
            }
            if (data.length === 0) {
                return res.status(404).json({ message: "Post not found or you are not authorized to delete it!" });
            }
            const { mediaUrl } = data[0];
            
            // const deleteS3Object = async (url) => {
            //     const key = s3KeyFromUrl(url); 
            //     if (!key) {
            //         console.error("Invalid S3 object URL:", url);
            //         return null;
            //     }
            //     try {
            //         const deleteCommand = new DeleteObjectCommand({
            //             Bucket: process.env.BUCKET_NAME,
            //             Key: key,
            //         });
            //         await s3.send(deleteCommand);
            //         console.log("S3 object deleted successfully:", key);
            //     } catch (s3Error) {
            //         console.error("Error deleting S3 object:", s3Error);
            //         throw new Error("Error deleting file from S3");
            //     }
            // };
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
            
            const deletePostQuery = "DELETE FROM communityposts WHERE id = ? AND userId = ?";
            db.query(deletePostQuery, [postId, user.id], (err, result) => {
                if (err) {
                    console.error("Database deletion error:", err);
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

// SHUUFLE POSTS
const shufflePosts = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};