import { db } from "../../config/connectDB.js"; // Ensure this import supports promises (e.g., mysql2/promise)
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js"; // For group icon uploads
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl, deleteS3Object } from "../../middlewares/S3bucketConfig.js";

const isCommunityAdmin = async (userId, communityId) => {
    const query = "SELECT isAdmin FROM community_members WHERE communityId = ? AND userId = ? AND isAdmin = 1";
    try {
        const [results] = await db.promise().query(query, [communityId, userId]);
        return results.length > 0;
    } catch (err) {
        console.error(`[DB Helper Error] Failed to check admin status for user ${userId} in community ${communityId}:`, err);
        throw new Error("Database error checking admin status.");
    }
};

export const joinChatGroupInternal = async (userId, chatGroupId) => {
    try {
        // Check if user is already a member of this specific chat group
        const checkQuery = "SELECT id FROM chat_group_members WHERE chatGroupId = ? AND userId = ?";
        const [results] = await db.promise().query(checkQuery, [chatGroupId, userId]);

        if (results.length > 0) {
            console.log(`[DB Helper] User ${userId} is already a member of chat group ${chatGroupId}.`);
            return { message: "Already a member of this chat group." };
        }

        //ADD USER TO chat_group_members TABLE
        const insertQuery = "INSERT INTO chat_group_members (chatGroupId, userId) VALUES (?, ?)";
        const [data] = await db.promise().query(insertQuery, [chatGroupId, userId]);

        console.log(`[DB Helper] User ${userId} successfully joined chat group ${chatGroupId}.`);
        return { message: "Successfully joined chat group.", data };
    } catch (err) {
        console.error(`[DB Helper Error] Error joining chat group internally for user ${userId} to group ${chatGroupId}:`, err);
        throw err;
    }
};

// const deleteS3Object = async (url) => {
//     const key = s3KeyFromUrl(url);
//     if (!key) {
//         console.warn(`[S3 Helper] Invalid S3 object URL for deletion (skipped): ${url}`);
//         return;
//     }
//     try {
//         const deleteCommand = new DeleteObjectCommand({ 
//             Bucket: process.env.BUCKET_NAME,
//             Key: key,
//         });
//         await s3.send(deleteCommand);
//         console.log(`[S3 Helper] S3 object deleted successfully: ${key}`);
//     } catch (s3Error) {
//         console.error(`[S3 Error] Error deleting S3 object ${key}:`, s3Error);
//         throw new Error("Error deleting file from S3");
//     }
// };

// --- API TO CREATE A NEW CHAT GROUP (by Community Admin) ---

export const createGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                console.error("[Multer Error] File upload error during group creation:", err);
                return res.status(500).json({ message: "File upload error", error: err.message });
            } else if (err) {
                console.error("[Multer Error] Unknown file upload error during group creation:", err);
                return res.status(500).json({ message: "Unknown error during file upload", error: err.message });
            }

            try {
                const user = req.user;
                const { communityId } = req.params; // :comunityId
                const { title, type, isDefault } = req.body;

                console.log(`[Chat Group Create] User ${user.id} attempting to create group in community ${communityId}. Data: ${JSON.stringify({title, type, isDefault})}`);

                if (!communityId || !title || !type) {
                    console.warn("[Chat Group Create] Missing communityId, title, or type.");
                    return res.status(400).json({ message: "Community ID, group title, and type are required." });
                }

                // VERIFY PRIVILEGES
                const isAdmin = await isCommunityAdmin(user.id, communityId);
                if (!isAdmin) {
                    console.warn(`[Chat Group Create] User ${user.id} is not an admin of community ${communityId}.`);
                    return res.status(403).json({ message: "You must be a community admin to create groups." });
                }

                // GROUP NAME CHECK TO AVOID CONFLICTS
                const checkGroupExistsQuery = "SELECT id FROM `chat_groups` WHERE communityId = ? AND name = ?";
                const [existingGroup] = await db.promise().query(checkGroupExistsQuery, [communityId, title]);
                if (existingGroup.length > 0) {
                    console.warn(`[Chat Group Create] Group with title '${title}' already exists in community ${communityId}.`);
                    return res.status(409).json({ message: "A group with this title already exists in this community." });
                }

                // UPLOAD GROUP ICON TO S3
                const groupIconFile = req.files && req.files["groupIcon"] ? req.files["groupIcon"][0] : null;
                let groupIconUrl = null;
                if (groupIconFile) {
                    try {
                        const params = {
                            Bucket: process.env.BUCKET_NAME,
                            Key: `uploads/groups/${Date.now()}_${groupIconFile.originalname}`,
                            Body: groupIconFile.buffer,
                            ContentType: groupIconFile.mimetype,
                        };
                        const command = new PutObjectCommand(params);
                        await s3.send(command);
                        groupIconUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
                        console.log(`[S3] Group icon uploaded: ${groupIconUrl}`);
                    } catch (uploadError) {
                        console.error("[S3 Error] Error uploading group icon to S3:", uploadError);
                        return res.status(500).json({ message: "Error uploading group icon", error: uploadError.message });
                    }
                }

                const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
                const isDefaultVal = isDefault ? 1 : 0;

                // INSERT NEW CHAT GROUP
                const createGroupQuery = "INSERT INTO `chat_groups` (`communityId`, `name`, `type`, `isDefault`, `groupIcon`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)";
                const groupValues = [communityId, title, type, isDefaultVal, groupIconUrl, timestamp];

                const [groupResult] = await db.promise().query(createGroupQuery, groupValues);
                const chatGroupId = groupResult.insertId;
                console.log(`[Chat Group Create] Group '${title}' created with ID: ${chatGroupId} in community ${communityId}.`);

                //AUTO ADD GROUP CREATOR TO NEW GROUP
                try {
                    await joinChatGroupInternal(user.id, chatGroupId);
                    console.log(`[Chat Group Create] Creator ${user.id} automatically joined newly created chat group ${chatGroupId}.`);
                } catch (autoJoinErr) {
                    console.error(`[Chat Group Create] Error automatically joining creator to new group ${chatGroupId}:`, autoJoinErr);// GROUP CREATED ALBEIT ERROR LOG
                }

                res.status(201).json({ message: "Chat group created successfully.", chatGroupId });

            } catch (error) {
                console.error("[Unexpected Error] An unexpected error occurred in createGroup:", error);
                res.status(500).json({ message: "An unexpected error occurred", error: error.message });
            }
        });
    });
};

// --- API TO EDIT AN EXISTING CHAT GROUP (by Community Admin) ---
export const editGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                console.error("[Multer Error] File upload error during group edit:", err);
                return res.status(500).json({ message: "File upload error", error: err.message });
            } else if (err) {
                console.error("[Multer Error] Unknown file upload error during group edit:", err);
                return res.status(500).json({ message: "Unknown error during file upload", error: err.message });
            }

            try {
                const user = req.user;
                const { chatGroupId } = req.params;
                const { title, type, isDefault, clearGroupIcon } = req.body;

                console.log(`[Chat Group Edit] User ${user.id} attempting to edit group ${chatGroupId}. Data: ${JSON.stringify(req.body)}`);

                if (!chatGroupId) {
                    console.warn("[Chat Group Edit] Chat group ID is required for edit.");
                    return res.status(400).json({ message: "Chat group ID is required." });
                }

                // FETCH GROUP INFO
                const getGroupQuery = "SELECT communityId, groupIcon FROM `chat_groups` WHERE id = ?";
                const [groupInfo] = await db.promise().query(getGroupQuery, [chatGroupId]);

                if (groupInfo.length === 0) {
                    console.warn(`[Chat Group Edit] Group ${chatGroupId} not found.`);
                    return res.status(404).json({ message: "Chat group not found." });
                }
                const { communityId, groupIcon: oldGroupIcon } = groupInfo[0];

                // VERIFY PRIVILEDGES
                const isAdmin = await isCommunityAdmin(user.id, communityId);
                if (!isAdmin) {
                    console.warn(`[Chat Group Edit] User ${user.id} is not an admin of community ${communityId}.`);
                    return res.status(403).json({ message: "You must be a community admin to edit groups." });
                }

                let updateFields = [];
                let updateValues = [];

                if (title) { updateFields.push("name = ?"); updateValues.push(title); }
                if (type) { updateFields.push("type = ?"); updateValues.push(type); }
                if (isDefault !== undefined) { updateFields.push("isDefault = ?"); updateValues.push(isDefault ? 1 : 0); }

                // Step 3: Handle group icon updates/deletions
                const groupIconFile = req.files && req.files["groupIcon"] ? req.files["groupIcon"][0] : null;
                let newGroupIconUrl = oldGroupIcon;

                if (clearGroupIcon === 'true') { // Request to clear existing icon
                    if (oldGroupIcon) {
                        await deleteS3Object(oldGroupIcon);
                    }
                    newGroupIconUrl = null;
                    updateFields.push("groupIcon = ?"); updateValues.push(newGroupIconUrl);
                    console.log(`[Chat Group Edit] Group icon cleared for group ${chatGroupId}.`);
                } else if (groupIconFile) { 
                    if (oldGroupIcon) {
                        await deleteS3Object(oldGroupIcon); 
                    }
                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: `uploads/groups/${Date.now()}_${groupIconFile.originalname}`,
                        Body: groupIconFile.buffer,
                        ContentType: groupIconFile.mimetype,
                    };
                    const command = new PutObjectCommand(params);
                    await s3.send(command);
                    newGroupIconUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${params.Key}`;
                    updateFields.push("groupIcon = ?"); updateValues.push(newGroupIconUrl);
                    console.log(`[S3] New group icon uploaded for group ${chatGroupId}: ${newGroupIconUrl}`);
                }

                if (updateFields.length === 0) {
                    console.warn("[Chat Group Edit] No fields provided for update.");
                    return res.status(400).json({ message: "No fields to update." });
                }

                // UPDATE `chat_groups` TABLE
                const updateQuery = `UPDATE \`chat_groups\` SET ${updateFields.join(", ")} WHERE id = ?`;
                updateValues.push(chatGroupId);

                const [updateResult] = await db.promise().query(updateQuery, updateValues);

                if (updateResult.affectedRows === 0) {
                    console.warn(`[Chat Group Edit] Group ${chatGroupId} not updated (no changes or group not found).`);
                    return res.status(404).json({ message: "Chat group not found or no changes made." });
                }

                console.log(`[Chat Group Edit] Group ${chatGroupId} updated successfully.`);
                res.status(200).json({ message: "Chat group updated successfully." });

            } catch (error) {
                console.error("[Unexpected Error] An unexpected error occurred in editGroup:", error);
                res.status(500).json({ message: "An unexpected error occurred", error: error.message });
            }
        });
    });
};


// --- API TO DELETE A CHAT GROUP (by Community Admin) ---
export const deleteGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const user = req.user;
            const { chatGroupId } = req.params;

            console.log(`[Chat Group Delete] User ${user.id} attempting to delete chat group ${chatGroupId}.`);

            if (!chatGroupId) {
                console.warn("[Chat Group Delete] Chat group ID is required for delete.");
                return res.status(400).json({ message: "Chat group ID is required." });
            }

            // GET GROUP INFO AND PARENT ID
            const getGroupQuery = "SELECT communityId, groupIcon FROM `chat_groups` WHERE id = ?";
            const [groupInfo] = await db.promise().query(getGroupQuery, [chatGroupId]);

            if (groupInfo.length === 0) {
                console.warn(`[Chat Group Delete] Group ${chatGroupId} not found.`);
                return res.status(404).json({ message: "Chat group not found." });
            }
            const { communityId, groupIcon } = groupInfo[0];

            // VERIFY PRIVILEGES
            const isAdmin = await isCommunityAdmin(user.id, communityId);
            if (!isAdmin) {
                console.warn(`[Chat Group Delete] User ${user.id} is not an admin of community ${communityId}.`);
                return res.status(403).json({ message: "You must be a community admin to delete groups." });
            }

            // DELETE GROUP ICON FROM S3 IF EXISTS
            try {
                if (groupIcon) {
                    await deleteS3Object(groupIcon);
                }
            } catch (s3Error) {
                console.error(`[S3 Error] Error deleting group icon for ${chatGroupId} from S3 (non-blocking):`, s3Error);
            }

            // Step 4: Delete the group from `chat_groups` table
            // Due to CASCADE DELETE foreign keys, this should automatically delete:
            // - entries in `chat_group_members` for this chat group
            // - entries in `groupmessages` for this chat group (and related reactions/threads)
            // - entries in `user_activity` and `user_level_history` for this chat group
            // - entries in `moderation_actions` for this chat group
            const deleteGroupQuery = "DELETE FROM `chat_groups` WHERE id = ?";
            const [deleteResult] = await db.promise().query(deleteGroupQuery, [chatGroupId]);

            if (deleteResult.affectedRows === 0) {
                // This scenario should ideally be caught by the prior `getGroupQuery`
                console.warn(`[Chat Group Delete] No group record deleted for ID ${chatGroupId}.`);
                return res.status(404).json({ message: "Chat group not found or already deleted." });
            }

            console.log(`[Chat Group Delete] Chat group ${chatGroupId} deleted successfully by admin ${user.id}.`);
            res.status(200).json({ message: "Chat group deleted successfully." });

        } catch (error) {
            console.error("[Unexpected Error] An unexpected error occurred in deleteGroup:", error);
            res.status(500).json({ message: "An unexpected error occurred", error: error.message });
        }
    });
};

// --- API TO VIEW A SPECIFIC CHAT GROUP'S DETAILS ---
export const getGroupDetails = (req, res) => {
    authenticateUser(req, res, async () => {
        const { chatGroupId } = req.params;
        const userId = req.user.id;

        console.log(`[Chat Group API] Fetching details for chat group ${chatGroupId} by user ${userId}.`);

        if (!chatGroupId) {
            console.warn("[Chat Group API] Chat group ID is required for getGroupDetails.");
            return res.status(400).json({ message: "Chat group ID is required." });
        }

        try {
            // Step 1: Fetch chat group details from `chat_groups`
            // Aliasing `name` as `title` for consistent frontend property.
            const query = `
                SELECT
                    g.id,
                    g.communityId,
                    g.name AS title, -- Using 'name' column for group title
                    g.groupIcon,
                    g.type,
                    g.isDefault,
                    g.createdAt,
                    CASE WHEN (SELECT COUNT(*) FROM chat_group_members WHERE chatGroupId = g.id AND userId = ?) > 0 THEN TRUE ELSE FALSE END AS isJoined
                FROM
                    \`chat_groups\` AS g
                WHERE
                    g.id = ?;
            `;
            const [results] = await db.promise().query(query, [userId, chatGroupId]);

            if (results.length === 0) {
                console.warn(`[Chat Group API] Chat group ${chatGroupId} not found.`);
                return res.status(404).json({ message: "Chat group not found." });
            }

            const chatGroup = results[0];

            // Generate S3 URL for group icon
            if (chatGroup.groupIcon) {
                try {
                    chatGroup.groupIcon = await generateS3Url(s3KeyFromUrl(chatGroup.groupIcon));
                } catch (error) {
                    console.error(`[S3 Error] Error generating icon URL for chat group ${chatGroup.id}:`, error);
                    chatGroup.groupIcon = null;
                }
            }
            console.log(`[Chat Group API] Fetched details for chat group ${chatGroupId}.`);
            res.status(200).json(chatGroup);

        } catch (error) {
            console.error("[Chat Group Error] Error fetching chat group details:", error);
            res.status(500).json({ message: "Internal server error fetching chat group details.", error: error.message });
        }
    });
}; 

// --- API TO JOIN A SPECIFIC CHAT GROUP (Public) ---
export const joinChatGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        const user = req.user;
        const chatGroupId = req.params.id; //chatGroupId

        console.log(`[Chat Group Controller] User ${user.id} attempting to join chat group ${chatGroupId}.`);

        try {
            // VERIFY GROUP EXISTENCE
            const getCommunityIdQuery = "SELECT communityId FROM `chat_groups` WHERE id = ?";
            const [chatGroupInfo] = await db.promise().query(getCommunityIdQuery, [chatGroupId]);

            if (chatGroupInfo.length === 0) {
                console.warn(`[Chat Group] Chat group ${chatGroupId} not found.`);
                return res.status(404).json({ message: "Chat group not found." });
            }

            const parentCommunityId = chatGroupInfo[0].communityId;
            console.log(`[Chat Group] Chat group ${chatGroupId} belongs to community ${parentCommunityId}.`);

            // CHECK IF USER IS A MEMBER OF THE COMMUNITY
            const checkCommunityMembershipQuery = "SELECT id FROM community_members WHERE communityId = ? AND userId = ?";
            const [communityMemberships] = await db.promise().query(checkCommunityMembershipQuery, [parentCommunityId, user.id]);

            if (communityMemberships.length === 0) {
                console.warn(`[Chat Group] User ${user.id} is not a member of parent community ${parentCommunityId}.`);
                return res.status(403).json({ message: "You must join the community first to join its chat groups." });
            } 

            console.log(`[Chat Group] User ${user.id} is a member of community ${parentCommunityId}. Proceeding to join chat group.`);

            //ADD USER TO GROUP
            const result = await joinChatGroupInternal(user.id, chatGroupId);
            console.log(`[Chat Group] User ${user.id} processed for chat group ${chatGroupId}:`, result.message);

            if (result.message.includes("Already a member")) {
                return res.status(409).json(result);
            }

            res.status(200).json(result);

        } catch (error) {
            console.error("[Chat Group Error] Error joining chat group:", error);
            res.status(500).json({ message: "Internal server error joining chat group.", error: error.message });
        }
    });
};


// --- API TO LEAVE A SPECIFIC CHAT GROUP ---
export const leaveChatGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        const user = req.user;
        const chatGroupId = req.params.id; //:chatGroupId

        console.log(`[Chat Group Controller] User ${user.id} attempting to leave chat group ${chatGroupId}.`);

        try {
            // DELETE MEMBERSHIP FROM THE GROUP(INTERNAL)
            const deleteQuery = "DELETE FROM chat_group_members WHERE chatGroupId = ? AND userId = ?";
            const [result] = await db.promise().query(deleteQuery, [chatGroupId, user.id]);

            if (result.affectedRows === 0) {
                console.warn(`[Chat Group] User ${user.id} was not a member of chat group ${chatGroupId} (no record deleted).`);
                return res.status(404).json({ message: "You are not a member of this chat group." });
            }
            console.log(`[Chat Group] User ${user.id} successfully left chat group ${chatGroupId}.`);
            res.status(200).json({ message: "Successfully left chat group." });

        } catch (error) {
            console.error("[Chat Group Error] Error leaving chat group:", error);
            res.status(500).json({ message: "Internal server error leaving chat group.", error: error.message });
        }
    });
};

//GET ALL GROUPS IN A COMMUNITY
export const getCommunityChatGroups = (req, res) => {
    authenticateUser(req, res, async () => {
        const { communityId } = req.params;
        const userId = req.user.id;

        console.log(`[Chat Group Controller] Fetching all chat groups for community ${communityId} by user ${userId}.`);

        try {
            // VERIFY COMMUNITY MEMBERSHIP
            const checkCommunityMembershipQuery = "SELECT id FROM community_members WHERE communityId = ? AND userId = ?";
            const [communityMemberships] = await db.promise().query(checkCommunityMembershipQuery, [communityId, userId]);

            if (communityMemberships.length === 0) {
                console.warn(`[Chat Group] User ${userId} is not a member of community ${communityId}, cannot view its chat groups.`);
                return res.status(403).json({ message: "You must be a member of the community to view its chat groups." });
            }
            console.log(`[Chat Group] User ${userId} is a member of community ${communityId}. Proceeding to fetch chat groups.`);

            // QUERY TO FETCH ALL CHAT GROUPS IN A COMMUNITY
            const query = `
                SELECT
                    cg.id,
                    cg.name AS title, -- Using 'name' column for group title
                    cg.groupIcon,
                    cg.type,
                    cg.isDefault,
                    cg.createdAt,
                    CASE WHEN cgm.userId IS NOT NULL THEN TRUE ELSE FALSE END as isJoined
                FROM
                    \`chat_groups\` cg
                LEFT JOIN
                    chat_group_members cgm ON cg.id = cgm.chatGroupId AND cgm.userId = ?
                WHERE
                    cg.communityId = ?
                ORDER BY cg.name;
            `;
            const [chatGroups] = await db.promise().query(query, [userId, communityId]);
            console.log(`[Chat Group] Fetched ${chatGroups.length} chat groups for community ${communityId}.`);

            const processedChatGroups = await Promise.all(
                chatGroups.map(async (group) => {
                    if (group.groupIcon) {
                        try {
                            const groupIconKey = s3KeyFromUrl(group.groupIcon);
                            group.groupIcon = await generateS3Url(groupIconKey);
                        } catch (error) {
                            console.error(`[S3 Error] Error generating group icon URL for chat group ${group.id}:`, error);
                            group.groupIcon = null;
                        }
                    }
                    return group;
                })
            );

            res.status(200).json(processedChatGroups);

        } catch (error) {
            console.error("[Chat Group Error] Error fetching community chat groups:", error);
            res.status(500).json({ message: "Internal server error fetching chat groups.", error: error.message });
        }
    });
};

//API TO GET SPECIFIC CHAT GROUPS (USER)
export const getMyChatGroupsInCommunity = (req, res) => {
    authenticateUser(req, res, async () => {
        const { communityId } = req.params;
        const userId = req.user.id;

        console.log(`[Chat Group Controller] Fetching user ${userId}'s joined chat groups in community ${communityId}.`);

        try {
            // VERIFY USER MEMBERSHIP
            const checkCommunityMembershipQuery = "SELECT id FROM community_members WHERE communityId = ? AND userId = ?";
            const [communityMemberships] = await db.promise().query(checkCommunityMembershipQuery, [communityId, userId]);

            if (communityMemberships.length === 0) {
                console.warn(`[Chat Group] User ${userId} is not a member of community ${communityId}, cannot view their joined chat groups.`);
                return res.status(403).json({ message: "You must be a member of the community to view its chat groups." });
            }
            console.log(`[Chat Group] User ${userId} is a member of community ${communityId}. Proceeding to fetch their joined chat groups.`);

            // FETCH GROUPS USER IS A PART OF
            const query = `
                SELECT
                    cg.id,
                    cg.name AS title, -- Using 'name' column for group title
                    cg.groupIcon,
                    cg.type,
                    cg.isDefault,
                    cg.createdAt
                FROM
                    \`chat_groups\` cg
                JOIN
                    chat_group_members cgm ON cg.id = cgm.chatGroupId
                WHERE
                    cg.communityId = ? AND cgm.userId = ?
                ORDER BY cg.name;
            `;
            const [myChatGroups] = await db.promise().query(query, [communityId, userId]);
            console.log(`[Chat Group] User ${userId} is a member of ${myChatGroups.length} chat groups in community ${communityId}.`);

            // S3 CONFIG
            const processedMyChatGroups = await Promise.all(
                myChatGroups.map(async (group) => {
                    if (group.groupIcon) {
                        try {
                            const groupIconKey = s3KeyFromUrl(group.groupIcon);
                            group.groupIcon = await generateS3Url(groupIconKey);
                        } catch (error) {
                            console.error(`[S3 Error] Error generating group icon URL for user's chat group ${group.id}:`, error);
                            group.groupIcon = null;
                        }
                    }
                    return group;
                })
            );

            res.status(200).json(processedMyChatGroups);

        } catch (error) {
            console.error("[Chat Group Error] Error fetching user's chat groups in community:", error);
            res.status(500).json({ message: "Internal server error fetching user's chat groups.", error: error.message });
        }
    });
};