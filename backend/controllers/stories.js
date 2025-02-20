import { db } from "../config/connectDB.js";
import { authenticateUser } from "../middlewares/verify.mjs";
import moment from "moment";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../middlewares/S3bucketConfig.js";
import { cpUpload } from "../middlewares/storage.js";

// Utility function for deleting S3 objects
const deleteS3Object = async (url) => {
  const key = s3KeyFromUrl(url);
  if (!key) {
    console.warn("Invalid S3 object URL, skipping deletion:", url); // Use warn for non-critical issues
    return;
  }
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });
    await s3.send(deleteCommand);
    console.log("S3 object deleted successfully:", key);
  } catch (s3Error) {
    console.error("Error deleting S3 object:", key, s3Error);
    throw s3Error; // Re-throw to be caught in the calling function
  }
};

// API TO CREATE NEW STORY
export const addStory = (req, res) => {
  authenticateUser(req, res, () => {
    const user = req.user;
    cpUpload(req, res, async (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ message: "Error uploading files", error: err });
      }

      const storyImages = req.files["storyImages"];
      const storyVideos = req.files["storyVideos"];

      const storyImageUrls = [];
      const storyVideoUrls = [];

      // Upload images to S3
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

      // Upload videos to S3
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

      // Save story data to the database
      const q = "INSERT INTO stories (`storyImage`, `text`, `storyVideo`, `userId`, `createdAt`) VALUES (?)";
      const values = [
        storyImageUrls.join(","),
        req.body.text,
        storyVideoUrls.join(","),
        user.id,
        moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
      ];

      db.query(q, [values], (err, data) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json(err);
        }
        res.status(200).json({ message: "Story added successfully", data });
      });
    });
  });
};

// API TO VIEW STORIES
export const viewStory = (req, res) => {
  authenticateUser(req, res, async () => {
    const q = `
      SELECT s.*, u.id AS userId, u.username, u.profilePic 
      FROM stories AS s
      JOIN users AS u ON u.id = s.userId
      ORDER BY s.createdAt DESC
    `;

    db.query(q, async (err, data) => {
      if (err) return res.status(500).json(err);

      const stories = await Promise.all(
        data.map(async (story) => {
          if (story.storyImage) {
            const storyImagesKey = s3KeyFromUrl(story.storyImage);
            story.storyImage = await generateS3Url(storyImagesKey);
          }
          if (story.storyVideo) {
            const storyVideosKey = s3KeyFromUrl(story.storyVideo);
            story.storyVideo = await generateS3Url(storyVideosKey);
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

// STORY EXPIRATION FUNCTION
async function deleteOldData() {
  const twentyFourHoursAgo = moment().subtract(1, 'days').format("YYYY-MM-DD HH:mm:ss");
  const selectQuery = "SELECT id, storyImage, storyVideo FROM stories WHERE createdAt < ?";

  try {
    // Step 1: Select old stories
    db.query(selectQuery, [twentyFourHoursAgo], async (err, results) => {
      if (err) {
        console.error("Error selecting old stories:", err);
        return; // Exit, don't proceed to delete
      }

      // Step 2: Iterate over old stories and delete S3 objects
      for (const story of results) {
        try {
          if (story.storyImage) {
            // Split multiple images into array of URLs
            const imageUrls = story.storyImage.split(",");
            for (const imageUrl of imageUrls) {
              await deleteS3Object(imageUrl);
            }
          }
          if (story.storyVideo) {
            // Split multiple videos into array of URLs
            const videoUrls = story.storyVideo.split(",");
            for (const videoUrl of videoUrls) {
              await deleteS3Object(videoUrl);
            }
          }

          // Step 3: Delete story from the database
          const deleteQuery = "DELETE FROM stories WHERE id = ?";
          db.query(deleteQuery, [story.id], (deleteErr, deleteResult) => {
            if (deleteErr) {
              console.error(`Error deleting story ${story.id} from database:`, deleteErr);
            } else {
              console.log(`Story ${story.id} deleted from database.`);
            }
          });
        } catch (s3Error) {
          console.error(`Error deleting S3 objects for story ${story.id}:`, s3Error);
          // Continue to the next story if deletion fails
        }
      }
    });
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
}

// Run the function every 24 hours (in milliseconds)
const twentyFourHours = 24 * 60 * 60 * 1000;
setInterval(deleteOldData, twentyFourHours);

// API TO DELETE STORY
export const deleteStory = (req, res) => {
  authenticateUser(req, res, () => {
    const user = req.user;
    const storyId = req.params.id;

    const getStory = "SELECT storyImage AS imageUrl, storyVideo AS videoUrl FROM stories WHERE id = ? AND userId = ?";
    db.query(getStory, [storyId, user.id], async (err, data) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ message: "Database query error", error: err });
      }
      if (data.length === 0) {
        return res.status(404).json({ message: "Story not found" });
      }

      const { imageUrl, videoUrl } = data[0];

      try {
        if (imageUrl) {
          // Split multiple images into array of URLs
          const imageUrls = imageUrl.split(",");
          for (const imgUrl of imageUrls) {
            await deleteS3Object(imgUrl);
          }
        }
        if (videoUrl) {
          // Split multiple videos into array of URLs
          const videoUrls = videoUrl.split(",");
          for (const vidUrl of videoUrls) {
            await deleteS3Object(vidUrl);
          }
        }
      } catch (deleteError) {
        return res.status(500).json({ message: "Error deleting S3 objects", error: deleteError });
      }

      const deleteStoryQuery = "DELETE FROM stories WHERE id = ? AND userId = ?";
      db.query(deleteStoryQuery, [storyId, user.id], (err, result) => {
        if (err) {
          return res.status(500).json({ message: "Database deletion error", error: err });
        }
        if (result.affectedRows > 0) {
          return res.status(200).json({ message: "Story deleted successfully." });
        } else {
          return res.status(403).json({ message: "You can only delete your own stories." });
        }
      });
    });
  });
};