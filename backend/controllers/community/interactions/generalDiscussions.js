//Backend
import { Server } from "socket.io";
import moment from "moment";
import { db } from "../../../config/connectDB.js";
import { authenticateSocket } from "../../../middlewares/socketVerification.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../../middlewares/S3bucketConfig.js";


export const initializeMessageSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:3001",
            credentials: true,
        },
    });

    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.user.id}`);

        socket.on("joinGroup", ({ groupId }) => {
            if (!groupId) {
                return socket.emit("error", { message: "Group ID is required." });
            }

            socket.join(groupId);
            console.log(`User ${socket.user.id} joined group ${groupId}`);
            io.to(groupId).emit("userJoined", { userId: socket.user.id }); // emit user joined to the group
        });

        socket.on("sendMessage", async ({ groupId, message, media, replyTo, audio }) => {
            try {
                if (!groupId || (!message && (!media || !media.length) && !audio)) {
                    return socket.emit("error", { message: "Message, media or audio is required." });
                }

                let mediaUrls = [];
                if (media && media.length > 0) {
                  mediaUrls = media;
                }

                let audioUrl = null;
                if (audio) {
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: `uploads/${Date.now()}_audio.webm`,
                        Body: Buffer.from(audio.split(",")[1], 'base64'),
                        ContentType: "audio/webm",
                    };
                    const command = new PutObjectCommand(params);
                    await s3.send(command);
                    audioUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
                }


                // Fetch user data outside the db.query for message insert
                const userQuery = `SELECT full_name, profilePic,
           SUBSTRING_INDEX(full_name, ' ', 1) as firstName,
            SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 2) as lastName
             FROM users WHERE id = ?`;
                const userResult = await new Promise((resolve, reject) => {
                    db.query(userQuery, [socket.user.id], (err, res) => {
                        if (err) reject(err);
                        else resolve(res);
                    });
                });

                if (!userResult || userResult.length === 0) {
                    console.error("Error fetching user data:", userResult);
                    return socket.emit("error", { message: "Error fetching user data" });
                }

                const user = userResult[0];
                if (user.profilePic) {
                    const profilePicKey = s3KeyFromUrl(user.profilePic);
                    user.profilePic = await generateS3Url(profilePicKey);
                }

                let replyData = null;
                if (replyTo && replyTo.messageId) {
                    const replyQuery = `SELECT gm.userId, gm.text,
                  u.profilePic, SUBSTRING_INDEX(u.full_name, ' ', 1) as firstName,
                  SUBSTRING(u.full_name, LENGTH(SUBSTRING_INDEX(u.full_name, ' ', 1)) + 2) as lastName
                 FROM groupmessages gm
                 INNER JOIN users u ON gm.userId = u.id
                  WHERE gm.id = ?`;

                    const replyResult = await new Promise((resolve, reject) => {
                        db.query(replyQuery, [replyTo.messageId], (err, res) => {
                            if (err) reject(err);
                            else resolve(res);
                        });
                    });
                    if (!replyResult || replyResult.length === 0) {
                        console.error("Error fetching reply message:", "No reply message found");
                        return socket.emit("error", { message: "Error fetching reply message", error: "No message found" });
                    }

                    const repliedMessage = replyResult[0];
                    if (repliedMessage.profilePic) {
                        const replyProfilePicKey = s3KeyFromUrl(repliedMessage.profilePic);
                        repliedMessage.profilePic = await generateS3Url(replyProfilePicKey);
                    }
                    replyData = {
                        messageId: replyTo.messageId,
                        firstName: repliedMessage.firstName,
                        lastName: repliedMessage.lastName,
                        userId: repliedMessage.userId,
                        message: repliedMessage.text,
                        profilePic: repliedMessage.profilePic,
                    };
                }


                const messageQuery = `
               INSERT INTO groupmessages (userId, groupId, text, media, createdAt, replyToMessageId, audio)
              VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

                const values = [
                    socket.user.id,
                    groupId,
                    message || null,
                    mediaUrls.join(",") || null,
                    moment().format("YYYY-MM-DD HH:mm:ss"),
                    replyTo?.messageId || null,
                    audioUrl
                ];

                const insertResult = await new Promise((resolve, reject) => {
                    db.query(messageQuery, values, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });

                if (!insertResult) {
                    console.error("Error saving message: No results from insert");
                    return socket.emit("error", { message: "Database error", error: "No results from insert" });
                }


                const newMessage = {
                    id: insertResult.insertId,
                    senderId: socket.user.id,
                    groupId,
                    message,
                    media: mediaUrls,
                    createdAt: values[4],
                    firstName: user.firstName,
                    lastName: user.lastName,
                    full_name: user.full_name,
                    profilePic: user.profilePic,
                    replyTo: replyData,
                    audio: audioUrl,
                };

                socket.broadcast.to(groupId).emit("newMessage", newMessage); // Broadcast to others in group
                //  socket.emit("messageSent", newMessage); this will emit new messages and cause duplication on state changes
            } catch (err) {
                console.error("Error sending message:", err);
                socket.emit("error", { message: "Internal server error", error: err });
            }
        });

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.user.id}`);
        });
    });

    return io;
};