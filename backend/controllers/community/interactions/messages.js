import { db } from "../../../config/connectDB.js";
import { authenticateUser } from "../../../middlewares/verify.mjs";
import { generateS3Url, s3KeyFromUrl, s3 } from "../../../middlewares/S3bucketConfig.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });


export const uploadMessageMedia = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            if (!req.file) {
                return res.status(400).send({ message: "No file was uploaded." });
            }
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: `uploads/${Date.now()}_${req.file.originalname}`,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            };
            const command = new PutObjectCommand(params);
            await s3.send(command);
            const mediaUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
            res.status(200).send({
                mediaUrl
            });
        } catch (error) {
            console.error("Error uploading file:", error);
            res.status(500).send({ message: "Error uploading file.", error: error });
        }
    });
};


export const fetchGroupMessages = async (req, res) => {
    authenticateUser(req, res, async () => {
        const { groupId } = req.params;
        try {
            const query = `
            SELECT gm.id, gm.userId as senderId, gm.groupId, gm.text as message, gm.media, gm.createdAt,
                u.full_name, u.profilePic,
                SUBSTRING_INDEX(u.full_name, ' ', 1) as firstName,
                 SUBSTRING(u.full_name, LENGTH(SUBSTRING_INDEX(u.full_name, ' ', 1)) + 2) as lastName,
                gm.replyToMessageId,
                 (SELECT u2.full_name FROM users u2 INNER JOIN groupmessages gm2 ON gm2.userId = u2.id WHERE gm2.id = gm.replyToMessageId) as replyToUsername,
                (SELECT  SUBSTRING_INDEX(u2.full_name, ' ', 1) FROM users u2 INNER JOIN groupmessages gm2 ON gm2.userId = u2.id WHERE gm2.id = gm.replyToMessageId) as replyToFirstName,
                (SELECT SUBSTRING(u2.full_name, LENGTH(SUBSTRING_INDEX(u2.full_name, ' ', 1)) + 2)  FROM users u2 INNER JOIN groupmessages gm2 ON gm2.userId = u2.id WHERE gm2.id = gm.replyToMessageId) as replyToLastName,
                (SELECT u2.profilePic FROM users u2 INNER JOIN groupmessages gm2 ON gm2.userId = u2.id WHERE gm2.id = gm.replyToMessageId) as replyToProfilePic,
                (SELECT gm2.text FROM groupmessages gm2 WHERE gm2.id = gm.replyToMessageId) as replyToMessage,
                 gm.audio
            FROM groupmessages gm
            INNER JOIN users u ON gm.userId = u.id
            WHERE gm.groupId = ?
            ORDER BY gm.createdAt ASC
            `;

            db.query(query, [groupId], async (err, results) => {
                if (err) {
                    console.error("Error fetching messages:", err);
                    return res.status(500).json({ message: "Error fetching messages" });
                }
                const messages = await Promise.all(
                    results.map(async (row) => {
                         if (row.profilePic) {
                            const profilePicKey = s3KeyFromUrl(row.profilePic);
                             row.profilePic = await generateS3Url(profilePicKey);
                        }
                           if (row.replyToProfilePic) {
                             const replyProfilePicKey = s3KeyFromUrl(row.replyToProfilePic);
                             row.replyToProfilePic = await generateS3Url(replyProfilePicKey);
                        }
                        let mediaUrls = [];
                      if(row.media){
                         mediaUrls = await Promise.all(row.media.split(",").map(async (mediaUrl) => {
                           if(!mediaUrl) return null;
                           const mediaKey = s3KeyFromUrl(mediaUrl);
                             return  await generateS3Url(mediaKey);
                        }));
                         }

                        const replyTo = row.replyToMessageId
                            ? {
                              messageId: row.replyToMessageId,
                                 firstName: row.replyToFirstName,
                                lastName: row.replyToLastName,
                              message: row.replyToMessage,
                              full_name: row.replyToUsername,
                            profilePic: row.replyToProfilePic,
                         }
                            : null;

                        return {
                          id: row.id,
                            senderId: row.senderId,
                           groupId: row.groupId,
                         message: row.message,
                           media: mediaUrls,
                         createdAt: row.createdAt,
                        full_name: row.full_name,
                         profilePic: row.profilePic,
                       firstName: row.firstName,
                         lastName: row.lastName,
                            replyTo: replyTo,
                           audio: row.audio,
                       };
                    })
                );
                 return res.json(messages);
           });
        } catch (err) {
             console.error("Error fetching initial messages:", err);
             res.status(500).json({ message: "Internal server error" });
        }
   });
};

export const editMessage = async (req, res) => {
    authenticateUser(req, res, async () => {
         const { messageId } = req.params;
          const { message } = req.body;

         try {
            db.query(
                "UPDATE groupmessages SET text = ? WHERE id = ?",
              [message, messageId],
                (err) => {
                 if (err) {
                    console.error("Error updating message:", err);
                     return res.status(500).json({ message: "Error updating message" });
                }
                res.status(200).json({ message: "Message updated successfully" });
              }
           );
     } catch (err) {
         console.error("Error updating message:", err);
            res.status(500).json({ message: "Internal server error" });
         }
   });
};


export const deleteMessage = async (req, res) => {
  authenticateUser(req, res, async () => {
    const { messageId } = req.params;
    try {

      const getMessageQuery = `SELECT media FROM groupmessages WHERE id = ?`;
       const result = await new Promise((resolve, reject) => {
          db.query(getMessageQuery, [messageId], (err, res) => {
            if (err) {
              console.error("Error deleting message:", err);
              reject(err)
             }
             else resolve(res)
           });
        });

        if(result && result.length > 0){
           const media = result[0].media;
           if(media){
               const mediaArray = media.split(",");
               await Promise.all(mediaArray.map(async (mediaUrl) => {
               if(!mediaUrl) return null;
                    const mediaKey = s3KeyFromUrl(mediaUrl)
                     try {
                       await s3.deleteObject({ Bucket: process.env.BUCKET_NAME, Key: mediaKey });
                    }
                    catch (error) {
                        console.error("Error deleting image from s3:", error)
                  }
           }));
          }
        }

      db.query(
        "DELETE FROM groupmessages WHERE id = ?",
           [messageId],
        (err) => {
              if (err) {
                 console.error("Error deleting message:", err);
               return res.status(500).json({ message: "Error deleting message" });
             }
               res.status(200).json({ message: "Message deleted successfully" });
        }
      );

        } catch (err) {
          console.error("Error deleting message:", err);
          res.status(500).json({ message: "Internal server error" });
    }
  });
};

export const uploadSingle = upload.single("media");