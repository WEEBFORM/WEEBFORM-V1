import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import { fetchCommunityInfo, getUserJoinedCommunityIds, getFriendCommunityIds } from "./communityHelpers.js";
import { joinChatGroupInternal } from './communityGroups.js';
import { createNotification } from "../notificationsController.js";
import { resizeImage } from '../../middlewares/cloudfrontConfig.js';

// --- API TO CREATE NEW COMMUNITY ---
export const createCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err) return res.status(400).json({ message: "File upload error", error: err.message });
            
            try {
                const user = req.user;
                const { title, description, visibility } = req.body;

                if (!title) return res.status(400).json({ message: "Community title is required" });

                const [existing] = await db.promise().query("SELECT id FROM communities WHERE title = ?", [title]);
                if (existing.length > 0) return res.status(409).json({ message: "A community with this title already exists." });
                
                if (!req.files || !req.files["groupIcon"] || !req.files["groupIcon"][0]) {
                    return res.status(400).json({ message: "A community icon image is required." });
                }

                const groupIconFile = req.files["groupIcon"][0];
                const resizedBuffer = await resizeImage(groupIconFile.buffer, 300, 300);
                const key = `uploads/communities/${Date.now()}_${groupIconFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;

                await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' }));
                const groupIconKey = key;

                const finalVisibility = (visibility == 1) ? 1 : 0;
                const finalDescription = description || `Welcome to ${title}'s Official Community on Weebform.`;
                const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");

                const [communityResult] = await db.promise().query(
                    "INSERT INTO communities (`creatorId`, `title`, `description`, `groupIcon`, `visibility`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)",
                    [user.id, title, finalDescription, groupIconKey, finalVisibility, timestamp]
                );
                const communityId = communityResult.insertId;

                await db.promise().query("INSERT INTO community_members (`communityId`, `userId`, `isAdmin`) VALUES (?, ?, ?)", [communityId, user.id, 1]);

                const defaultChatGroups = [
                    { title: `${title} General Chat`, type: 'text', isDefault: true },
                    { title: `${title} Announcements`, type: 'announcement', isDefault: true }
                ];
                const groupValues = defaultChatGroups.map(group => [group.title, communityId, group.type, group.isDefault, null, timestamp]);
                const [groupResult] = await db.promise().query("INSERT INTO `chat_groups` (`name`, `communityId`, `type`, `isDefault`, `groupIcon`, `createdAt`) VALUES ?", [groupValues]);

                const firstGroupId = groupResult.insertId;
                for (let i = 0; i < defaultChatGroups.length; i++) {
                    await joinChatGroupInternal(user.id, firstGroupId + i);
                }

                return res.status(201).json({ message: "Community created successfully.", communityId });
                
            } catch (error) {
                console.error("[Error] createCommunity:", error);
                return res.status(500).json({ message: "An unexpected error occurred.", error: error.message });
            }
        });
    });
};

// --- API TO EDIT COMMUNITY DETAILS ---
export const editCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err) return res.status(400).json({ message: "File upload error", error: err.message });

            try {
                const userId = req.user.id;
                const communityId = req.params.id;
                const { title, description, visibility } = req.body;
                
                const [communityData] = await db.promise().query("SELECT creatorId, groupIcon FROM communities WHERE id = ?", [communityId]);
                if (communityData.length === 0) return res.status(404).json({ message: "Community not found." });

                const community = communityData[0];
                if (community.creatorId !== userId) return res.status(403).json({ message: "You are not authorized to edit this community." });

                let newGroupIconKey = null;
                const groupIconFile = req.files && req.files["groupIcon"] ? req.files["groupIcon"][0] : null;

                if (groupIconFile) {
                    const resizedBuffer = await resizeImage(groupIconFile.buffer, 300, 300);
                    const key = `uploads/communities/${Date.now()}_${groupIconFile.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
                    await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, Body: resizedBuffer, ContentType: 'image/webp' }));
                    newGroupIconKey = key;
                }

                const updateFields = [];
                const updateValues = [];

                if (title) { updateFields.push("`title` = ?"); updateValues.push(title); }
                if (description) { updateFields.push("`description` = ?"); updateValues.push(description); }
                if (newGroupIconKey) { updateFields.push("`groupIcon` = ?"); updateValues.push(newGroupIconKey); }
                if (visibility !== undefined) { updateFields.push("`visibility` = ?"); updateValues.push(visibility == 1 ? 1 : 0); }

                if (updateFields.length === 0) return res.status(400).json({ message: "No fields to update were provided." });

                updateValues.push(communityId, userId);
                const [result] = await db.promise().query(`UPDATE communities SET ${updateFields.join(", ")} WHERE id = ? AND creatorId = ?`, updateValues);

                if (result.affectedRows > 0) {
                    if (newGroupIconKey && community.groupIcon) {
                        await deleteS3Object(community.groupIcon);
                    }
                    return res.status(200).json({ message: "Community updated successfully." });
                } else {
                    return res.status(404).json({ message: "Update failed. Community not found or you are not the creator." });
                }

            } catch (error) {
                console.error("[Error] editCommunity:", error);
                return res.status(500).json({ message: "An internal server error occurred.", error: error.message });
            }
        });
    });
};

// --- API TO VIEW JOINED COMMUNITIES ---
export const yourCommunities = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const joinedCommunityIds = await getUserJoinedCommunityIds(userId);
            if (joinedCommunityIds.length === 0) return res.status(200).json([]);

            const communities = await fetchCommunityInfo(joinedCommunityIds, userId, { includeMemberCount: true });
            res.status(200).json(communities);
        } catch (error) {
            console.error("[Error] yourCommunities:", error);
            return res.status(500).json({ message: "Database error fetching joined communities." });
        }
    });
};

// --- API TO VIEW CREATED COMMUNITIES ---
export const getCreatedCommunities = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const [rows] = await db.promise().query("SELECT id FROM communities WHERE creatorId = ?", [userId]);
            const createdCommunityIds = rows.map(c => c.id);
            if (createdCommunityIds.length === 0) return res.status(200).json([]);

            const communities = await fetchCommunityInfo(createdCommunityIds, userId, { includeMemberCount: true, includeUserMembership: true });
            res.status(200).json(communities);
        } catch (error) {
            console.error("[Error] getCreatedCommunities:", error);
            return res.status(500).json({ message: "Database error fetching created communities." });
        }
    });
};

// --- API TO VIEW ALL COMMUNITIES (Categorized Discovery) ---
export const communities = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const allCommunitiesData = await fetchCommunityInfo([], userId, { includeMemberCount: true, includeUserMembership: true });
            const friendCommunityIds = new Set(await getFriendCommunityIds(userId));

            const joinedResult = allCommunitiesData.filter(c => c.isCommunityMember);
            const discoveryPool = allCommunitiesData.filter(c => !c.isCommunityMember);

            const recommendedResult = discoveryPool.filter(c => friendCommunityIds.has(c.id));
            const recommendedIds = new Set(recommendedResult.map(c => c.id));

            const popularResult = discoveryPool
                .filter(c => !recommendedIds.has(c.id))
                .sort((a, b) => b.memberCount - a.memberCount)
                .slice(0, 10);
            const popularIds = new Set(popularResult.map(c => c.id));

            const othersResult = discoveryPool.filter(c => !recommendedIds.has(c.id) && !popularIds.has(c.id));
            
            res.status(200).json({
                recommended: recommendedResult,
                popular: popularResult,
                others: othersResult,
                joined: joinedResult
            });
        } catch (error) {
            console.error("[Error] communities:", error);
            return res.status(500).json({ message: "An unexpected error occurred while fetching communities." });
        }
    });
};

// --- API TO VIEW SPECIFIC COMMUNITY DETAILS ---
export const getCommunityDetails = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const communityId = req.params.id;
            const userId = req.user.id;
            if (!communityId) return res.status(400).json({ error: "Community ID is required." });

            const [community] = await fetchCommunityInfo([communityId], userId, {
                includeMemberCount: true,
                includeUserMembership: true,
                includeChatGroups: true,
                includeCreatorInfo: true
            });

            if (!community) return res.status(404).json({ error: "Community not found." });

            res.status(200).json(community);
        } catch (error) {
            console.error("[Error] getCommunityDetails:", error);
            return res.status(500).json({ message: "Database error fetching community details." });
        }
    });
};

// --- JOIN COMMUNITY ---
export const joinCommunity = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const communityId = req.params.id;
    
            // Check if community exists and get creatorId
            const [communityData] = await db.promise().query("SELECT creatorId, title FROM communities WHERE id = ?", [communityId]);
            if (communityData.length === 0) return res.status(404).json({ message: "Community not found." });
            
            const { creatorId, title } = communityData[0];

            const [membership] = await db.promise().query("SELECT id FROM community_members WHERE communityId = ? AND userId = ?", [communityId, userId]);
            if (membership.length > 0) return res.status(409).send({ message: "You are already a member of this community." });
    
            await db.promise().query("INSERT INTO community_members (`communityId`, `userId`, `isAdmin`) VALUES (?, ?, ?)", [communityId, userId, 0]);
    
            const [defaultGroups] = await db.promise().query("SELECT id FROM `chat_groups` WHERE communityId = ? AND isDefault = TRUE", [communityId]);
            for (const group of defaultGroups) {
                await joinChatGroupInternal(userId, group.id);
            }

            // Create notification for the community creator
            await createNotification('COMMUNITY_JOIN', userId, creatorId, { communityId }, { communityTitle: title });
    
            res.status(200).json({ message: "Successfully joined community." });
        } catch (error) {
            console.error("[Error] joinCommunity:", error);
            return res.status(500).json({ message: "Failed to join community." });
        }
    });
};

// --- LEAVE COMMUNITY ---
export const exitCommunity = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const communityId = req.params.id;
    
            const [exitResult] = await db.promise().query("DELETE FROM `community_members` WHERE communityId = ? AND userId = ?", [communityId, userId]);
            if (exitResult.affectedRows === 0) return res.status(404).json({ message: "You are not a member of this community." });
    
            const [userChatGroups] = await db.promise().query(
                `SELECT cgm.chatGroupId FROM chat_group_members cgm JOIN \`chat_groups\` cg ON cgm.chatGroupId = cg.id WHERE cg.communityId = ? AND cgm.userId = ?`,
                [communityId, userId]
            );
    
            if (userChatGroups.length > 0) {
                const chatGroupIdsToLeave = userChatGroups.map(g => g.chatGroupId);
                await db.promise().query("DELETE FROM chat_group_members WHERE userId = ? AND chatGroupId IN (?)", [userId, chatGroupIdsToLeave]);
            }
    
            return res.status(200).json({ message: `Successfully left the community.` });
        } catch (error) {
            console.error("[Error] exitCommunity:", error);
            return res.status(500).json({ message: "Error leaving community." });
        }
    });
};

// --- API TO DELETE COMMUNITY --- 
export const deleteCommunity = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const communityId = req.params.id;
    
            const [data] = await db.promise().query("SELECT groupIcon FROM communities WHERE id = ? AND creatorId = ?", [communityId, userId]);
            if (data.length === 0) return res.status(404).json({ message: "Community not found or you are not authorized to delete it." });
    
            const { groupIcon } = data[0];
            if (groupIcon) await deleteS3Object(groupIcon);
    
            const [chatGroupIcons] = await db.promise().query("SELECT groupIcon FROM `chat_groups` WHERE communityId = ? AND groupIcon IS NOT NULL", [communityId]);
            for (const group of chatGroupIcons) { await deleteS3Object(group.groupIcon); }
    
            const [result] = await db.promise().query("DELETE FROM communities WHERE id = ? AND creatorId = ?", [communityId, userId]);
            if (result.affectedRows > 0) {
                return res.status(200).json({ message: "Community deleted successfully." });
            } else {
                return res.status(403).json({ message: "You can only delete your own community." });
            }
        } catch (error) {
            console.error("[Error] deleteCommunity:", error);
            return res.status(500).json({ message: "Database deletion error.", error: error.message });
        }
    });
};

//NEW, INVITE MEMBER TO COMMUNITY
// --- API TO INVITE A USER TO A PRIVATE COMMUNITY ---
export const inviteToCommunity = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const inviterId = req.user.id;
            const { communityId } = req.params;
            const { inviteeId } = req.body;

            if (!inviteeId) return res.status(400).json({ message: "Invitee user ID is required." });

            const [adminCheck] = await db.promise().query("SELECT isAdmin FROM community_members WHERE communityId = ? AND userId = ?", [communityId, inviterId]);
            if (adminCheck.length === 0 || !adminCheck[0].isAdmin) {
                return res.status(403).json({ message: "You must be an admin to send invitations." });
            }

            // const [communityData] = await db.promise().query("SELECT visibility, title FROM communities WHERE id = ?", [communityId]);
            // if (communityData.length === 0) return res.status(404).json({ message: "Community not found." });
            // if (communityData[0].visibility !== 0) {
            //     return res.status(400).json({ message: "This community is public; no invitation is needed." });
            // }

            // CHECK IF INVITEE EXISTS
            const [memberCheck] = await db.promise().query("SELECT id FROM community_members WHERE communityId = ? AND userId = ?", [communityId, inviteeId]);
            if (memberCheck.length > 0) return res.status(409).json({ message: "This user is already a member." });

            // CHECK FOR EXISTING PENDING INVITATION
            const [inviteCheck] = await db.promise().query("SELECT id FROM community_invitations WHERE communityId = ? AND inviteeId = ? AND status = 'pending'", [communityId, inviteeId]);
            if (inviteCheck.length > 0) return res.status(409).json({ message: "This user already has a pending invitation." });

            // PROCESS THE INVITATION
            await db.promise().query("INSERT INTO community_invitations (communityId, inviterId, inviteeId) VALUES (?, ?, ?)", [communityId, inviterId, inviteeId]);
            
            // NOTIFY INVITEE
            await createNotification(
                'COMMUNITY_INVITE',
                inviterId,
                inviteeId,
                { communityId },
                { communityTitle: communityData[0].title }
            );

            res.status(200).json({ message: "Invitation sent successfully." });

        } catch (error) {
            console.error("[Error] inviteToCommunity:", error);
            return res.status(500).json({ message: "Failed to send invitation.", error: error.message });
        }
    });
};

// --- API FOR AN INVITEE TO ACCEPT A COMMUNITY INVITATION ---
export const acceptCommunityInvitation = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const inviteeId = req.user.id;
            const { invitationId } = req.params;

            // FETCH AND VALIDATE INVITATION
            const [inviteData] = await db.promise().query("SELECT * FROM community_invitations WHERE id = ?", [invitationId]);
            if (inviteData.length === 0) return res.status(404).json({ message: "Invitation not found." });

            const invite = inviteData[0];
            if (invite.inviteeId !== inviteeId) return res.status(403).json({ message: "This invitation is not for you." });
            if (invite.status !== 'pending') return res.status(400).json({ message: `This invitation has already been ${invite.status}.` });

            // Start a transaction
            const connection = await db.promise().getConnection();
            await connection.beginTransaction();

            try {
                // Add user to the community
                await connection.query("INSERT INTO community_members (communityId, userId, isAdmin) VALUES (?, ?, ?)", [invite.communityId, inviteeId, 0]);

                // Add user to default chat groups
                const [defaultGroups] = await connection.query("SELECT id FROM `chat_groups` WHERE communityId = ? AND isDefault = TRUE", [invite.communityId]);
                for (const group of defaultGroups) {
                    // Using joinChatGroupInternal logic directly within the transaction
                    await connection.query("INSERT INTO chat_group_members (chatGroupId, userId) VALUES (?, ?)", [group.id, inviteeId]);
                }

                await connection.query("UPDATE community_invitations SET status = 'accepted' WHERE id = ?", [invitationId]);
                
                await connection.commit();

                const [community] = await db.promise().query("SELECT title FROM communities WHERE id = ?", [invite.communityId]);
                await createNotification(
                    'COMMUNITY_INVITE_ACCEPTED',
                    inviteeId,
                    invite.inviterId,
                    { communityId: invite.communityId },
                    { communityTitle: community[0].title, inviteeUsername: req.user.username }
                );

                res.status(200).json({ message: "Invitation accepted. Welcome to the community!" });

            } catch (transError) {
                await connection.rollback();
                throw transError;
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error("[Error] acceptCommunityInvitation:", error);
            return res.status(500).json({ message: "Failed to accept invitation.", error: error.message });
        }
    });
};