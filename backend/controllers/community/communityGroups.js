import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import { processImageUrl, resizeImage } from '../../middlewares/cloudfrontConfig.js';

export const isCommunityAdmin = async (userId, communityId) => {
    try {
        const [results] = await db.promise().query("SELECT isAdmin FROM community_members WHERE communityId = ? AND userId = ? AND isAdmin = 1", [communityId, userId]);
        return results.length > 0;
    } catch (err) {
        console.error(`[DB Helper Error] Failed to check admin status for user ${userId} in community ${communityId}:`, err);
        throw new Error("Database error checking admin status.");
    }
};

export const joinChatGroupInternal = async (userId, chatGroupId) => {
    try {
        const [results] = await db.promise().query("SELECT id FROM chat_group_members WHERE chatGroupId = ? AND userId = ?", [chatGroupId, userId]);
        if (results.length > 0) {
            return { message: "Already a member of this chat group." };
        }
        const [data] = await db.promise().query("INSERT INTO chat_group_members (chatGroupId, userId) VALUES (?, ?)", [chatGroupId, userId]);
        return { message: "Successfully joined chat group.", data };
    } catch (err) {
        console.error(`[DB Helper Error] Error joining chat group internally for user ${userId} to group ${chatGroupId}:`, err);
        throw err;
    }
};

// API TO CREATE A NEW CHAT GROUP
export const createGroup = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err) return res.status(400).json({ message: "File upload error", error: err.message });
            
            try {
                const user = req.user;
                const { communityId } = req.params;
                const { title, type, isDefault } = req.body;

                if (!communityId || !title || !type) return res.status(400).json({ message: "Community ID, group title, and type are required." });

                if (!await isCommunityAdmin(user.id, communityId)) {
                    return res.status(403).json({ message: "You must be a community admin to create groups." });
                }

                const [existingGroup] = await db.promise().query("SELECT id FROM `chat_groups` WHERE communityId = ? AND name = ?", [communityId, title]);
                if (existingGroup.length > 0) return res.status(409).json({ message: "A group with this title already exists in this community." });

                let groupIconKey = null;
                if (req.files && req.files["groupIcon"] && req.files["groupIcon"][0]) {
                    const groupIconFile = req.files["groupIcon"][0];
                    const resizedBuffer = await resizeImage(groupIconFile.buffer, 100, 100);
                    const key = `uploads/groups/${Date.now()}_${groupIconFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                    await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' }));
                    groupIconKey = key;
                }

                const [groupResult] = await db.promise().query(
                    "INSERT INTO `chat_groups` (`communityId`, `name`, `type`, `isDefault`, `groupIcon`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)",
                    [communityId, title, type, isDefault ? 1 : 0, groupIconKey, moment().format("YYYY-MM-DD HH:mm:ss")]
                );
                
                await joinChatGroupInternal(user.id, groupResult.insertId);
                res.status(201).json({ message: "Chat group created successfully.", chatGroupId: groupResult.insertId });

            } catch (error) {
                console.error("[Error] createGroup:", error);
                res.status(500).json({ message: "An unexpected error occurred", error: error.message });
            }
        });
    });
};

// API TO EDIT A CHAT GROUP
export const editGroup = (req, res) => {
  authenticateUser(req, res, () => {
    cpUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: "File upload error", error: err.message });
      }

      try {
        const user = req.user;
        const { chatGroupId } = req.params;
        const { title, type, isDefault, clearGroupIcon } = req.body;

        if (!chatGroupId) {
          return res.status(400).json({ message: "Chat group ID is required." });
        }

        // FETCH CURRENT GROUP INFO
        const [groupInfo] = await db.promise().query(
          "SELECT communityId, groupIcon FROM `chat_groups` WHERE id = ?",
          [chatGroupId]
        );

        if (groupInfo.length === 0) {
          return res.status(404).json({ message: "Chat group not found." });
        }

        const { communityId, groupIcon: oldGroupIconKey } = groupInfo[0];

        // ADMIN CHECK
        const [adminCheck] = await db.promise().query(
          "SELECT id FROM community_members WHERE communityId = ? AND userId = ? AND isAdmin = 1",
          [communityId, user.id]
        );

        if (adminCheck.length === 0) {
          return res.status(403).json({ message: "You must be a community admin to edit groups." });
        }

        // BUILD UPDATE QUERY
        const updateFields = [];
        const updateValues = [];

        if (title) {
          updateFields.push("name = ?");
          updateValues.push(title);
        }

        if (type) {
          updateFields.push("type = ?");
          updateValues.push(type);
        }

        if (isDefault !== undefined) {
          updateFields.push("isDefault = ?");
          updateValues.push(isDefault ? 1 : 0);
        }

        // GROUP ICON HANDLING
        const groupIconFile = req.files && req.files["groupIcon"] ? req.files["groupIcon"][0] : null;

        if (clearGroupIcon === "true") {
          if (oldGroupIconKey) await deleteS3Object(oldGroupIconKey);
          updateFields.push("groupIcon = ?");
          updateValues.push(null);
        } else if (groupIconFile) {
          if (oldGroupIconKey) await deleteS3Object(oldGroupIconKey);

          const resizedBuffer = await resizeImage(groupIconFile.buffer, 100, 100);
          const key = `uploads/groups/${Date.now()}_${groupIconFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_")}.webp`;

          await s3.send(
            new PutObjectCommand({
              Bucket: process.env.BUCKET_NAME,
              Key: key,
              Body: resizedBuffer,
              ContentType: "image/webp",
            })
          );

          updateFields.push("groupIcon = ?");
          updateValues.push(key);
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ message: "No fields to update." });
        }

        // FINALIZE AND EXECUTE UPDATE
        updateValues.push(chatGroupId);
        const [updateResult] = await db
          .promise()
          .query(`UPDATE \`chat_groups\` SET ${updateFields.join(", ")} WHERE id = ?`, updateValues);

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ message: "Chat group not found or no changes made." });
        }

        res.status(200).json({ message: "Chat group updated successfully." });
      } catch (error) {
        console.error("[Error] editGroup:", error);
        res.status(500).json({ message: "An unexpected error occurred", error: error.message });
      }
    });
  });
};



// API TO DELETE A CHAT GROUP
export const deleteGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const user = req.user;
            const { chatGroupId } = req.params;
            if (!chatGroupId) return res.status(400).json({ message: "Chat group ID is required." });

            const [groupInfo] = await db.promise().query("SELECT communityId, groupIcon FROM `chat_groups` WHERE id = ?", [chatGroupId]);
            if (groupInfo.length === 0) return res.status(404).json({ message: "Chat group not found." });
            
            const { communityId, groupIcon } = groupInfo[0];
            if (!await isCommunityAdmin(user.id, communityId)) {
                return res.status(403).json({ message: "You must be a community admin to delete groups." });
            }

            if (groupIcon) await deleteS3Object(groupIcon);

            const [deleteResult] = await db.promise().query("DELETE FROM `chat_groups` WHERE id = ?", [chatGroupId]);
            if (deleteResult.affectedRows === 0) return res.status(404).json({ message: "Chat group not found or already deleted." });

            res.status(200).json({ message: "Chat group deleted successfully." });
        } catch (error) {
            console.error("[Error] deleteGroup:", error);
            res.status(500).json({ message: "An unexpected error occurred", error: error.message });
        }
    });
};

// API TO VIEW A SPECIFIC CHAT GROUP'S DETAILS
export const getGroupDetails = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const { chatGroupId } = req.params;
            const userId = req.user.id;
            if (!chatGroupId) return res.status(400).json({ message: "Chat group ID is required." });

            const query = `
                SELECT g.id, g.communityId, g.name AS title, g.groupIcon, g.type, g.isDefault, g.createdAt,
                       (SELECT COUNT(*) FROM chat_group_members WHERE chatGroupId = g.id AND userId = ?) > 0 AS isJoined,
                       (SELECT COUNT(*) FROM community_members WHERE communityId = g.communityId AND userId = ? AND isAdmin = 1) > 0 AS isAdmin
                FROM \`chat_groups\` AS g WHERE g.id = ?;`;
            
            const [results] = await db.promise().query(query, [userId, userId, chatGroupId]);
            if (results.length === 0) return res.status(404).json({ message: "Chat group not found." });

            const chatGroup = results[0];
            chatGroup.groupIcon = processImageUrl(chatGroup.groupIcon);
            
            res.status(200).json(chatGroup);
        } catch (error) {
            console.error("[Error] getGroupDetails:", error);
            res.status(500).json({ message: "Internal server error fetching chat group details." });
        }
    });
}; 

// API TO JOIN A SPECIFIC CHAT GROUP
export const joinChatGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const user = req.user;
            const chatGroupId = req.params.id;

            const [chatGroupInfo] = await db.promise().query("SELECT communityId FROM `chat_groups` WHERE id = ?", [chatGroupId]);
            if (chatGroupInfo.length === 0) return res.status(404).json({ message: "Chat group not found." });
            
            const [communityMemberships] = await db.promise().query("SELECT id FROM community_members WHERE communityId = ? AND userId = ?", [chatGroupInfo[0].communityId, user.id]);
            if (communityMemberships.length === 0) return res.status(403).json({ message: "You must join the community first." });

            const result = await joinChatGroupInternal(user.id, chatGroupId);
            if (result.message.includes("Already a member")) return res.status(409).json(result);

            res.status(200).json(result);
        } catch (error) {
            console.error("[Error] joinChatGroup:", error);
            res.status(500).json({ message: "Internal server error joining chat group." });
        }
    });
};

// API TO LEAVE A SPECIFIC CHAT GROUP
export const leaveChatGroup = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const user = req.user;
            const chatGroupId = req.params.id;

            const [result] = await db.promise().query("DELETE FROM chat_group_members WHERE chatGroupId = ? AND userId = ?", [chatGroupId, user.id]);
            if (result.affectedRows === 0) return res.status(404).json({ message: "You are not a member of this chat group." });
            
            res.status(200).json({ message: "Successfully left chat group." });
        } catch (error) {
            console.error("[Error] leaveChatGroup:", error);
            res.status(500).json({ message: "Internal server error leaving chat group." });
        }
    });
};

//GET ALL GROUPS IN A COMMUNITY
export const getCommunityChatGroups = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const { communityId } = req.params;
            const userId = req.user.id;
            
            const query = `
                SELECT cg.id, cg.name AS title, cg.groupIcon, cg.type, cg.isDefault, cg.createdAt,
                       cgm.userId IS NOT NULL AS isJoined,
                       (
                           SELECT COUNT(*) FROM groupmessages gm 
                           WHERE gm.chatGroupId = cg.id 
                             AND gm.createdAt > COALESCE(cgm.lastReadAt, '1970-01-01')
                             AND gm.userId != ?
                       ) AS unreadCount
                FROM \`chat_groups\` cg
                LEFT JOIN chat_group_members cgm ON cg.id = cgm.chatGroupId AND cgm.userId = ?
                WHERE cg.communityId = ? ORDER BY cg.name;`;
            
            const [chatGroups] = await db.promise().query(query, [userId, userId, communityId]);
            const processedChatGroups = chatGroups.map(group => {
                group.groupIcon = processImageUrl(group.groupIcon);
                return group;
            });
            res.status(200).json(processedChatGroups);
        } catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
};

//API TO GET SPECIFIC CHAT GROUPS (USER)
export const getMyChatGroupsInCommunity = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const { communityId } = req.params;
            const userId = req.user.id;

            const [memberships] = await db.promise().query("SELECT id FROM community_members WHERE communityId = ? AND userId = ?", [communityId, userId]);
            if (memberships.length === 0) return res.status(403).json({ message: "You must be a member of the community to view its chat groups." });

            const query = `
                SELECT cg.id, cg.name AS title, cg.groupIcon, cg.type, cg.isDefault, cg.createdAt
                FROM \`chat_groups\` cg
                JOIN chat_group_members cgm ON cg.id = cgm.chatGroupId
                WHERE cg.communityId = ? AND cgm.userId = ? ORDER BY cg.name;`;
            
            const [myChatGroups] = await db.promise().query(query, [communityId, userId]);
            
            const processedMyChatGroups = myChatGroups.map(group => {
                group.groupIcon = processImageUrl(group.groupIcon);
                return group;
            });

            res.status(200).json(processedMyChatGroups);
        } catch (error) {
            console.error("[Error] getMyChatGroupsInCommunity:", error);
            res.status(500).json({ message: "Internal server error fetching user's chat groups." });
        }
    });
};

// API TO MARK A CHAT GROUP AS READ
export const markGroupAsRead = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const { chatGroupId } = req.params;
            await db.promise().query(
                "UPDATE chat_group_members SET lastReadAt = NOW() WHERE chatGroupId = ? AND userId = ?",
                [chatGroupId, userId]
            );
            res.status(200).json({ message: "Marked as read" });
        } catch (error) {
            res.status(500).json({ message: "Error updating read status" });
        }
    });
};