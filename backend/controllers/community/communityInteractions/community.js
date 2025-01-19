import { db } from "../../../config/connectDB.js";
import { authenticateUser } from "../../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../../middlewares/storage.js";
import multer from "multer";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../../middlewares/S3bucketConfig.js";

// API TO CREATE NEW COMMUNITY
export const createCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }

            const user = req.user;
            const title = req.body.title;

            // Check if community already exists
            const checkQuery = "SELECT * FROM communities WHERE title = ?";
            db.query(checkQuery, title, (err, data) => {
                if (data && data.length) {
                    return res.status(401).json("Community exists");
                }
            });

            // Upload group icon to S3
            const groupIconFile = req.files["groupIcon"] ? req.files["groupIcon"][0] : null;
            let groupIconUrl = null;

            if (groupIconFile) {
                try {
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: `uploads/communities/${Date.now()}_${groupIconFile.originalname}`,
                        Body: groupIconFile.buffer,
                        ContentType: groupIconFile.mimetype,
                    };
                    const command = new PutObjectCommand(params);
                    await s3.send(command);
                    groupIconUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
                } catch (uploadError) {
                    console.error("Error uploading group icon:", uploadError);
                    return res.status(500).json({ message: "Error uploading group icon", error: uploadError });
                }
            }

            if (!groupIconUrl) {
                return res.status(400).json("Error uploading community image");
            }

            const description = `Welcome to ${req.body.title}'s Official Community on Weebform.`;

            // Create community
            const createQuery = "INSERT INTO communities (`creatorId`, `title`, `description`, `groupIcon`, `createdAt`) VALUES (?)";
            const values = [
                user.id,
                req.body.title,
                description,
                groupIconUrl,
                moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
            ];

            db.query(createQuery, [values], (err, data) => {
                if (err) {
                    return (err);
                }
                const communityId = data.insertId;

                // Create default groups
                const defaultGroups = [
                    { title: "Announcements", groupIcon: "uploads/default group icons/announcements-icon.png" },
                    { title: "General Discussion", groupIcon: "uploads/default group icons/general-discussion-icon.png" },
                    { title: "Feed", groupIcon: "uploads/default group icons/feedback-icon.jpeg" }
                ];

                const groupsQuery = "INSERT INTO `groups` (`title`, `communityId`, `groupIcon`, `createdAt`) VALUES ?";
                const groupValues = defaultGroups.map(group => [
                    group.title,
                    communityId,
                    group.groupIcon,
                    moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
                ]);

                db.query(groupsQuery, [groupValues], (err) => {
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

// API TO VIEW JOINED COMMUNITIES
export const yourCommunities = (req, res) => {
    authenticateUser(req, res, () => {
        const userId = req.user.id;

        const query = `
            SELECT c.id, c.title, c.description, c.groupIcon, c.createdAt, cm.comId, cm.memberId 
            FROM members cm 
            JOIN communities c ON cm.comId = c.id 
            WHERE cm.memberId = ?;
        `;

        db.query(query, [userId], async (err, data) => {
            if (err) return res.status(500).json(err);

            if (!data || data.length === 0) {
                return res.status(404).json("You haven't joined a community.");
            }

            const processedCommunities = await Promise.all(
                data.map(async (community) => {
                    if (community.groupIcon) {
                        try {
                            const groupIconKey = s3KeyFromUrl(community.groupIcon);
                            community.groupIcon = await generateS3Url(groupIconKey);
                        } catch (error) {
                            console.error("Error generating group icon URL:", error);
                            community.groupIcon = null;
                        }
                    }
                    return community;
                })
            ); 

            res.status(200).json(processedCommunities);
        });
    });
};

// API TO VIEW ALL COMMUNITIES
export const communities = (req, res) => {
    authenticateUser(req, res, () => {
        const query = `
            SELECT 
                c.*, 
                (SELECT COUNT(*) FROM members WHERE comId = c.id) AS memberCount 
            FROM 
                communities AS c 
            ORDER BY 
                c.createdAt ASC
        `;

        db.query(query, async (err, data) => {
            if (err) return res.status(500).json(err);

            const processedCommunities = await Promise.all(
                data.map(async (community) => {
                    if (community.groupIcon) {
                        try {
                            const groupIconKey = s3KeyFromUrl(community.groupIcon);
                            community.groupIcon = await generateS3Url(groupIconKey);
                        } catch (error) {
                            console.error("Error generating group icon URL:", error);
                            community.groupIcon = null;
                        }
                    }
                    return community;
                })
            );   

            // Shuffle communities before returning
            const shuffled = processedCommunities.sort(() => Math.random() - 0.5);
            res.status(200).json(shuffled);
        });
    });
};

//API TO VIEW SPECIFIC COMMUNITY
export const getCommunityDetails = (req, res) => {
    authenticateUser(req, res, () => {
        const communityId = req.params.id;

        if (!communityId) {
            return res.status(400).json({ error: "Community ID is required." });
        }

        const query = `
            SELECT 
                c.*, 
                (SELECT COUNT(*) FROM members WHERE comId = c.id) AS memberCount 
            FROM 
                communities AS c 
            WHERE 
                c.id = ?
        `;

        db.query(query, [communityId], async (err, data) => {
            if (err) {
                console.error("Error fetching community details:", err);
                return res.status(500).json(err);
            }

            if (data.length === 0) {
                return res.status(404).json({ error: "Community not found." });
            }

            const community = data[0];

            // Process group icon if present
            if (community.groupIcon) {
                try {
                    const groupIconKey = s3KeyFromUrl(community.groupIcon);
                    community.groupIcon = await generateS3Url(groupIconKey);
                } catch (error) {
                    console.error("Error generating group icon URL:", error);
                    community.groupIcon = null;
                }
            }

            res.status(200).json(community);
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
                return res.status(409).send("You are already a member of this community.");
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

// API TO DELETE COMMUNITY
export const deleteCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;

        // Step 1: Retrieve community and associated group icons
        const getCommunity = "SELECT groupIcon FROM communities WHERE id = ? AND creatorId = ?";
        db.query(getCommunity, [req.params.id, user.id], async (err, data) => {
            if (err) {
                return res.status(500).json({ message: "Database query error", error: err });
            }
            if (data.length === 0) {
                return res.status(404).json({ message: "Community not found!" });
            }

            const { groupIcon } = data[0];

            // Function to delete S3 object
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

            // Step 2: Delete groupIcon from S3
            try {
                if (groupIcon) {
                    await deleteS3Object(groupIcon); 
                }
            } catch (deleteError) {
                return res.status(500).json({ message: "Error deleting S3 objects", error: deleteError });
            }

            // Step 3: Delete the community from the database
            const deleteCommunityQuery = "DELETE FROM communities WHERE id = ? AND creatorId = ?";
            db.query(deleteCommunityQuery, [req.params.id, user.id], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: "Database deletion error", error: err });
                }
                if (result.affectedRows > 0) {
                    return res.status(200).json({ message: "Community deleted successfully." });
                } else {
                    return res.status(403).json({ message: "You can only delete your own community." });
                }
            });
        });
    });
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