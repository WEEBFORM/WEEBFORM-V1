import {db} from "../config/connectDB.js";
import {authenticateUser} from "../middlewares/verify.mjs";
import {cpUpload} from "../middlewares/storage.js";
import multer from "multer";
import moment from "moment";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey} from "../middlewares/S3bucketConfig.js";

//API TO CREATE NEW STORY
export const addStory = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }   
            const storyImages = req.files['storyImages'];
            const storyVideos = req.files['storyVideos'];
            const storyImageUrls = [];
            const storyVideoUrls = [];
            if (storyImages) {
                for (const image of storyImages) {
                    try {
                        const params = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: `uploads/stories/${Date.now()}_${image.originalname}`,
                            Body: image.buffer,
                            ContentType: image.mimetype,
                        };
                        const command = new PutObjectCommand(params);
                        await s3.send(command);
                        storyImageUrls.push(`https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`);
                    } catch (uploadError) {
                        console.error("Error uploading image:", uploadError);
                        return res.status(500).json({ message: "Error uploading image to S3", error: uploadError });
                    }
                }
            }
            if (storyVideos) {
                for (const video of storyVideos) {
                    try {
                        const params = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: `uploads/stories/${Date.now()}_${video.originalname}`,
                            Body: video.buffer,
                            ContentType: video.mimetype,
                        };
                        const command = new PutObjectCommand(params);
                        await s3.send(command);
                        storyVideoUrls.push(`https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`);
                    } catch (uploadError) {
                        console.error("Error uploading video:", uploadError);
                        return res.status(500).json({ message: "Error uploading video to S3", error: uploadError });
                    }
                }
            }
            const q = "INSERT INTO stories (`storyImage`, `text`,`storyVideo`,`userId`,`createdAt`) VALUES (?)";
            const values = [
                storyImageUrls.join(","),
                req.body.text,
                storyVideoUrls.join(","),
                user.id,
                moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
            ];

            db.query(q, [values], (err, data) => {
                if (err) return res.status(500).json(err);
                res.status(200).json({ message: "Story added successfully", data });
            });
        });
    });
};

//API TO VIEW STORIES
export const viewStory = (req, res) => {
    authenticateUser(req, res, async () => {
        const user = req.user;
        const q = "SELECT s.*, u.id AS userId, username, profilePic FROM stories AS s JOIN users AS u ON (u.id = s.userId)";
        db.query(q, async (err, data) => {
            if (err) return res.status(500).json(err);
            const stories = await Promise.all(
                data.map(async (story) => {
                    if (story.storyImages) {
                        const storyImagesKey = s3KeyFromUrl(story.storyImages);
                        story.storyImages = await generateS3Url(storyImagesKey);
                    }  
                    if (story.storyVideos) {
                        const storyVideosKey = s3KeyFromUrl(story.storyVideos);
                        story.storyVideos = await generateS3Url(storyVideosKey);
                    }
                    if (story.profilePic) {
                        const profileKey = s3KeyFromUrl(story.profilePic);
                        story.profilePic = await generateS3Url(profileKey);
                    }           
                    return story;
                })
            );
            res.status(200).json(stories);
        });
    });
};

//STORY EXPIRATION FUNCTION
export default function deleteOldData() {
    const q = 'DELETE FROM stories WHERE createdAt < DATE_SUB(NOW(), INTERVAL 1 DAY)    ';
    db.query(q, (err, result) => {
      if (err){
        res.status(500).json("Internal server error")
      }else{
        return  res.status(200).json("Story deleted succesfully")
      }
    });
}

setInterval(deleteOldData, 24 * 60 * 60 * 1000);  

//API TO DELETE STORY
export const deleteStory = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const storyId = req.params.id
        const getStory = "SELECT storyImage AS imageUrl, storyVideo AS videoUrl FROM stories WHERE id = ? AND userId = ?";
        db.query(getStory, [storyId, user.id], async (err, data) => {
            if (err) {
                return res.status(500).json({ message: "Database query error", error: err });
            }
            if (data.length === 0) {
                return res.status(404).json({ message: "Story not found!" });
            }
            const { imageUrl, videoUrl } = data[0];
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
                if (imageUrl) await deleteS3Object(imageUrl);
                if (videoUrl) await deleteS3Object(videoUrl);
            } catch (deleteError) {
                return res.status(500).json({ message: "Error deleting S3 objects", error: deleteError });
            }
            const deletestoriesQuery = "DELETE FROM stories WHERE id = ? AND userId = ?";
            db.query(deletestoriesQuery, [req.params.id, user.id], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: "Database deletion error", error: err });
                }
                if (result.affectedRows > 0) {
                    return res.status(200).json({ message: "stories deleted successfully." });
                } else {
                    return res.status(403).json({ message: "You can only delete your own stories." });
                }
            });
        });
    });
};
