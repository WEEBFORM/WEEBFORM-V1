import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";

// API TO CREATE NEW COMMUNITY 
export const createCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) { 
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err }); 
            }
            
            try {
                const user = req.user; 
                const title = req.body.title;
                
                if (!title) {
                    return res.status(400).json({ message: "Community title is required" });
                }

                // Check if community exists with proper error handling
                const checkQuery = "SELECT * FROM communities WHERE title = ?";
                
                db.query(checkQuery, [title], async (err, data) => {
                    if (err) {
                        console.error("Database error checking community:", err);
                        return res.status(500).json({ message: "Database error", error: err });
                    }
                    
                    if (data && data.length) {
                        return res.status(409).json({ message: "Community already exists" });
                    }
                    
                    // S3 UPLOAD
                    const groupIconFile = req.files && req.files["groupIcon"] ? req.files["groupIcon"][0] : null;
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
                    } else {
                        return res.status(400).json({ message: "Community image is required" });
                    }

                    const description = req.body.description || `Welcome to ${title}'s Official Community on Weebform.`;
                    const timestamp = moment(Date.now()).format("YYYY-MM-DD HH:mm:ss");

                    // CREATE COMMUNITY QUERY
                    const createQuery = "INSERT INTO communities (`creatorId`, `title`, `description`, `groupIcon`, `createdAt`) VALUES (?)";
                    const values = [
                        user.id,
                        title,
                        description,
                        groupIconUrl,
                        timestamp
                    ];

                    db.query(createQuery, [values], (err, communityResult) => {
                        if (err) {
                            console.error("Error creating community:", err);
                            return res.status(500).json({ message: "Error creating community", error: err });
                        }
                        
                        const communityId = communityResult.insertId;

                        // Add creator as admin
                        const addAdminQuery = "INSERT INTO members (`comId`, `memberId`, `role`) VALUES (?)";
                        const addAdminValues = [
                            communityId,
                            user.id,
                            'admin'
                        ];
                        
                        db.query(addAdminQuery, [addAdminValues], (adminErr, adminResult) => {
                            if (adminErr) {
                                console.error( "Error setting creator as Admin", adminErr );
                                return res.status(500).json({ message: "Community created but failed to set admin", error: adminErr });
                            }

                            const defaultGroups = [
                                { title: `${title} Chat` }, 
                                { title: `${title} Main` } 
                            ];

                            const groupsQuery = "INSERT INTO `groups` (`title`, `communityId`, `createdAt`) VALUES ?";
                            const groupValues = defaultGroups.map(group => [
                                group.title,
                                communityId,
                                timestamp
                            ]);

                            db.query(groupsQuery, [groupValues], (groupErr, groupResult) => {
                                if (groupErr) {
                                    console.error("Error creating groups:", groupErr);
                                    return res.status(500).json({ message: "Community created, but failed to create groups." });
                                }
                                
                                return res.status(201).json({ 
                                    message: "Community and default groups successfully created.",
                                    communityId: communityId
                                });
                            });
                        });               
                    });
                });
            } catch (error) {
                console.error("Unexpected error:", error);
                return res.status(500).json({ message: "An unexpected error occurred", error: error.message });
            }
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
        const userId = req.user.id;
        
        try {
            // FETCH ALL COMMUNITIES
            const communitiesQuery = `
                SELECT 
                    c.*, 
                    (SELECT COUNT(*) FROM members WHERE comId = c.id) AS memberCount 
                FROM 
                    communities AS c 
                ORDER BY 
                    c.createdAt ASC
            `;
            
            db.query(communitiesQuery, async (err, allCommunities) => {
                if (err) {
                    console.error("Error fetching communities:", err);
                    return res.status(500).json({ message: "Database error", error: err });
                }

                // S3 PROCESS FOR ALL URLs
                const processedCommunities = await Promise.all(
                    allCommunities.map(async (community) => {
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
                
                // FIND COMMUNITIES WHERE FRIENDS ARE MEMBERS
                const friendsQuery = `
                    SELECT f.followed
                    FROM reach f
                    WHERE f.follower = ?
                `;
                
                db.query(friendsQuery, [userId], (err, friendsResult) => {
                    if (err) {
                        console.error("Error fetching friends:", err);
                        return res.status(500).json({ message: "Database error", error: err });
                    }
                    
                    // EXTRACT IDs
                    const followed = friendsResult.map(friend => friend.followed);
                    
                    if (followed.length > 0) {
                        const friendsCommunitiesQuery = `
                            SELECT DISTINCT m.comId
                            FROM members m
                            WHERE m.memberId IN (?)
                        `;
                        
                        db.query(friendsCommunitiesQuery, [followed], (err, friendCommunitiesResult) => {
                            if (err) {
                                console.error("Error fetching friend communities:", err);
                                return res.status(500).json({ message: "Database error", error: err });
                            }
                            
                            const friendCommunityIds = friendCommunitiesResult.map(fc => fc.comId);
                            
                            const recommended = processedCommunities.filter(c => friendCommunityIds.includes(c.id));
                            const popular = [...processedCommunities].sort((a, b) => b.memberCount - a.memberCount).slice(0, 5);
                            
                            // For explore/others, exclude communities that are in recommended
                            const others = processedCommunities.filter(c => !friendCommunityIds.includes(c.id));
                            
                            const section = req.query.section;
                            
                            if (section === 'recommended') {
                                return res.status(200).json({ 
                                    section: 'recommended',
                                    communities: recommended 
                                });
                            } else if (section === 'popular') {
                                return res.status(200).json({ 
                                    section: 'popular',
                                    communities: popular 
                                });
                            } else if (section === 'explore' || section === 'others') {
                                return res.status(200).json({ 
                                    section: 'explore',
                                    communities: others 
                                });
                            } else {
                                return res.status(200).json({
                                    recommended,
                                    popular,
                                    others,
                                    all: processedCommunities
                                });
                            }
                        });
                    } else {
                        //IN EVENT USER HAS NO FRIENDS
                        const popular = [...processedCommunities].sort((a, b) => b.memberCount - a.memberCount).slice(0, 5);
                        const others = processedCommunities;
                        
                        // CHECK REQUESTED SECTION
                        const section = req.query.section;
                        
                        if (section === 'recommended') {
                            return res.status(200).json({ 
                                section: 'recommended',
                                communities: [] 
                            });
                        } else if (section === 'popular') {
                            return res.status(200).json({ 
                                section: 'popular',
                                communities: popular 
                            });
                        } else if (section === 'explore' || section === 'others') {
                            return res.status(200).json({ 
                                section: 'explore',
                                communities: others 
                            });
                        } else {
                            // RETERN ALL CATEGORIES
                            return res.status(200).json({
                                recommended: [],
                                popular,
                                others,
                                all: processedCommunities
                            });
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Unexpected error:", error);
            return res.status(500).json({ message: "An unexpected error occurred", error: error.message });
        }
    });
};

//API TO VIEW SPECIFIC COMMUNITY
export const getCommunityDetails = (req, res) => {
    authenticateUser(req, res, () => {
        const communityId = req.params.id;

        if (!communityId) {
            return res.status(400).json({ error: "Community ID is required." });
        }

        const communityQuery = `
            SELECT 
                c.*, 
                (SELECT COUNT(*) FROM members WHERE comId = c.id) AS memberCount 
            FROM 
                communities AS c 
            WHERE 
                c.id = ?
        `;

        const groupsQuery = `
            SELECT 
                g.id, 
                g.title, 
                g.groupIcon, 
                g.createdAt 
            FROM 
                \`groups\` AS g 
            WHERE 
                g.communityId = ?
        `;

        db.query(communityQuery, [communityId], async (err, communityData) => {
            if (err) {
                console.error("Error fetching community details:", err);
                return res.status(500).json(err);
            }

            if (communityData.length === 0) {
                return res.status(404).json({ error: "Community not found." });
            }

            const community = communityData[0];

            // Process group icon for the community
            if (community.groupIcon) {
                try {
                    const groupIconKey = s3KeyFromUrl(community.groupIcon);
                    community.groupIcon = await generateS3Url(groupIconKey);
                } catch (error) {
                    console.error("Error generating group icon URL:", error);
                    community.groupIcon = null;
                }
            }

            // Fetch groups related to the community
            db.query(groupsQuery, [communityId], async (groupErr, groupsData) => {
                if (groupErr) {
                    console.error("Error fetching groups:", groupErr);
                    return res.status(500).json(groupErr);
                }

                const processedGroups = await Promise.all(
                    groupsData.map(async (group) => {
                        if (group.groupIcon) {
                            try {
                                const groupIconKey = s3KeyFromUrl(group.groupIcon);
                                group.groupIcon = await generateS3Url(groupIconKey);
                            } catch (error) {
                                console.error("Error generating group icon URL for group:", error);
                                group.groupIcon = null;
                            }
                        }
                        return group;
                    })
                );

                // Attach groups to the community response
                community.groups = processedGroups;

                res.status(200).json(community);
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
        const comId = req.params.id;

        if (!comId) {
            return res.status(400).json({ message: "Community ID is required." });
        }

        // Check if the user is a member of the community
        const membershipCheckQuery = `
            SELECT u.username, c.title 
            FROM members m
            JOIN users u ON m.memberId = u.id
            JOIN communities c ON m.comId = c.id
            WHERE m.memberId = ? AND m.comId = ?
        `;

        db.query(membershipCheckQuery, [user.id, comId], (checkErr, checkResult) => {
            if (checkErr) {
                console.error("Error checking membership:", checkErr);
                return res.status(500).json({ message: "Database error", error: checkErr });
            }

            if (checkResult.length === 0) {
                return res.status(404).json({ message: "Membership not found or invalid community." });
            }

            const username = checkResult[0].username;
            const communityTitle = checkResult[0].title;

            // Delete membership record
            const exitQuery = "DELETE FROM `members` WHERE comId = ? AND memberId = ?";
            db.query(exitQuery, [comId, user.id], (exitErr, exitResult) => {
                if (exitErr) {
                    console.error("Error exiting community:", exitErr);
                    return res.status(500).json({ message: "Error leaving community", error: exitErr });
                }

                if (exitResult.affectedRows === 0) {
                    return res.status(404).json({ message: "You are not a member of this community." });
                }

                return res
                    .status(200)
                    .json({ message: `${username} has successfully left the community: ${communityTitle}` });
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