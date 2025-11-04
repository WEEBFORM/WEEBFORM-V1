import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, deleteS3Object } from "../../middlewares/S3bucketConfig.js";
import { fetchCommunityInfo, getUserJoinedCommunityIds, getFriendCommunityIds } from "./communityHelpers.js";
import { joinChatGroupInternal } from './communityGroups.js';
import { createNotification } from "../notificationsController.js";
import { processImageUrl, resizeImage } from '../../middlewares/cloudfrontConfig.js';

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

// --- UTILITY FUNCTION TO SHUFFLE ARRAY ---
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// API TO FETCH ALL COMMUNITIES
export const getAllCommunities = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            // Fetch only public communities for general discovery
            const publicCommunities = await fetchCommunityInfo(
                [], 
                userId, 
                { 
                    includeMemberCount: true, 
                    includeUserMembership: true,
                    discoveryMode: true // <-- Ensures only public communities are fetched
                }
            );
            const result = shuffleArray(publicCommunities);
            res.status(200).json(result);

        } catch (error) {
            console.error("[Error] getAllCommunities:", error);
            return res.status(500).json({ 
                message: "An unexpected error occurred while fetching all communities.",
                error: error.message 
            });
        }
    });
};

// --- API TO VIEW COMMUNITIES (Categorized Discovery) ---
export const communities = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;

            // 1. Fetch all communities (public and private) that the user has joined
            const joinedCommunityIds = await getUserJoinedCommunityIds(userId);
            const joinedResult = joinedCommunityIds.length > 0 
                ? await fetchCommunityInfo(joinedCommunityIds, userId, { includeMemberCount: true, includeUserMembership: true })
                : [];

            // 2. Fetch all public communities for the discovery pool
            const publicCommunities = await fetchCommunityInfo([], userId, { 
                includeMemberCount: true, 
                includeUserMembership: true, 
                discoveryMode: true 
            });

            // 3. Filter the discovery pool to exclude communities the user has already joined
            const discoveryPool = publicCommunities.filter(c => !c.isCommunityMember);
            
            const friendCommunityIds = new Set(await getFriendCommunityIds(userId));

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
                joined: joinedResult // This list correctly includes the user's private communities
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

// API TO FETCH COMMUNITY MEMBERS
export const getCommunityMembers = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const communityId = req.params.id;

            if (!communityId) {
                return res.status(400).json({ message: "Community ID is required." });
            }

            // CHECK COMMUNITY VISIBILITY AND USER MEMBERSHIP
            const [communityData] = await db.promise().query(
                `SELECT c.visibility, 
                        (SELECT COUNT(*) FROM community_members WHERE communityId = c.id AND userId = ?) AS isMember 
                 FROM communities c WHERE c.id = ?`,
                [userId, communityId]
            );

            if (communityData.length === 0) {
                return res.status(404).json({ message: "Community not found." });
            }

            const { visibility, isMember } = communityData[0];

            if (visibility === 0 && !isMember) {
                return res.status(403).json({ message: "You do not have permission to view the members of this private community." });
            }
            const q = `
                SELECT 
                    u.id, 
                    u.username, 
                    u.full_name, 
                    u.profilePic,
                    cm.isAdmin
                FROM community_members AS cm
                JOIN users AS u ON cm.userId = u.id
                WHERE cm.communityId = ?
                ORDER BY cm.isAdmin DESC, u.username ASC
            `;
            
            const [members] = await db.promise().query(q, [communityId]);

            const processedMembers = members.map(member => {
                member.profilePic = processImageUrl(member.profilePic);
                return member;
            });

            res.status(200).json(processedMembers);

        } catch (error) {
            console.error("[Error] getCommunityMembers:", error);
            return res.status(500).json({ message: "Failed to fetch community members.", error: error.message });
        }
    });
};

// --- NEW: API TO FETCH USERS AN ADMIN CAN INVITE TO A COMMUNITY ---
export const getInvitableUsers = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const adminId = req.user.id;
            const { communityId } = req.params;

            // VERIFY ADMIN STATUS
            const [adminCheck] = await db.promise().query("SELECT isAdmin FROM community_members WHERE communityId = ? AND userId = ?", [communityId, adminId]);
            if (adminCheck.length === 0 || !adminCheck[0].isAdmin) {
                return res.status(403).json({ message: "You must be an admin to view invitable users." });
            }

            // GET ALL FOLLOWERS AND FOLLOWING FOR THE ADMIN (UNION removes duplicates)
            const friendsQuery = `
                (SELECT followed AS id FROM reach WHERE follower = ?)
                UNION
                (SELECT follower AS id FROM reach WHERE followed = ?)
            `;
            const [friends] = await db.promise().query(friendsQuery, [adminId, adminId]);
            const friendIds = new Set(friends.map(f => f.id));

            // GET ALL USERS ALREADY IN THE COMMUNITY
            const [members] = await db.promise().query("SELECT userId FROM community_members WHERE communityId = ?", [communityId]);
            const memberIds = new Set(members.map(m => m.userId));

            // FILTER OUT EXISTING MEMBERS
            const invitableIds = [...friendIds].filter(id => !memberIds.has(id));

            if (invitableIds.length === 0) {
                return res.status(200).json([]);
            }

            // FETCH PROFILE DETAILS FOR THE INVITABLE USERS
            const usersQuery = `
                SELECT id, username, full_name, profilePic 
                FROM users 
                WHERE id IN (?)
            `;
            const [invitableUsers] = await db.promise().query(usersQuery, [invitableIds]);

            const processedUsers = invitableUsers.map(user => {
                user.profilePic = processImageUrl(user.profilePic);
                return user;
            });

            res.status(200).json(processedUsers);

        } catch (error) {
            console.error("[Error] getInvitableUsers:", error);
            return res.status(500).json({ message: "Failed to fetch invitable users.", error: error.message });
        }
    });
};

// INVITE MEMBER TO COMMUNITY
export const addCommunityMember = (req, res) => {
    authenticateUser(req, res, async () => {
        const connection = await db.promise().getConnection();
        try {
            const adminId = req.user.id;
            const { communityId } = req.params;
            const { userIdToAdd } = req.body;

            if (!userIdToAdd || !Array.isArray(userIdToAdd) || userIdToAdd.length === 0) {
                return res.status(400).json({ message: "An array of user IDs to add is required." });
            }

            await connection.beginTransaction();

            // CHECK ADMIN PERMISSIONS
            const [adminCheck] = await connection.query("SELECT isAdmin FROM community_members WHERE communityId = ? AND userId = ?", [communityId, adminId]);
            if (adminCheck.length === 0 || !adminCheck[0].isAdmin) {
                await connection.rollback();
                return res.status(403).json({ message: "You must be an admin to add new members." });
            }

            // GET COMMUNITY AND DEFAULT GROUP INFO (once)
            const [communityData] = await connection.query("SELECT title FROM communities WHERE id = ?", [communityId]);
            if (communityData.length === 0) {
                 await connection.rollback();
                return res.status(404).json({ message: "Community not found." });
            }
            const communityTitle = communityData[0].title;
            const [defaultGroups] = await connection.query("SELECT id FROM `chat_groups` WHERE communityId = ? AND isDefault = TRUE", [communityId]);

            // PROCESS EACH USER
            let addedCount = 0;
            const skippedUsers = [];
            const addedUsers = [];

            for (const userId of userIdToAdd) {
                // Skip if the user is the admin themself
                if (userId === adminId) continue;

                // CHECK IF USER IS ALREADY A MEMBER
                const [memberCheck] = await connection.query("SELECT id FROM community_members WHERE communityId = ? AND userId = ?", [communityId, userId]);
                if (memberCheck.length > 0) {
                    skippedUsers.push({ userId, reason: "Already a member." });
                    continue;
                }

                // CHECK IF ADMIN AND USER ARE MUTUALS (one follows the other)
                const [friendshipCheck] = await connection.query(
                    "SELECT 1 FROM reach WHERE (follower = ? AND followed = ?) OR (follower = ? AND followed = ?)",
                    [adminId, userId, userId, adminId]
                );
                if (friendshipCheck.length === 0) {
                    // Fail the entire transaction if any user is not a follower/following
                    await connection.rollback();
                    return res.status(403).json({ message: `Failed to add users. You can only add users that you follow or who follow you. User ID: ${userId} is not a valid connection.` });
                }
                
                // ADD USER TO COMMUNITY AND DEFAULT GROUPS
                await connection.query("INSERT INTO community_members (communityId, userId, isAdmin) VALUES (?, ?, ?)", [communityId, userId, 0]);
                for (const group of defaultGroups) {
                    await connection.query("INSERT INTO chat_group_members (chatGroupId, userId) VALUES (?, ?)", [group.id, userId]);
                }
                
                addedUsers.push(userId);
                addedCount++;
            }

            await connection.commit();

            // SEND NOTIFICATIONS (after successful commit)
            for (const userId of addedUsers) {
                await createNotification('COMMUNITY_ADDED', adminId, userId, { communityId }, { communityTitle });
            }

            res.status(200).json({
                message: `Operation complete. Successfully added ${addedCount} user(s).`,
                skipped: skippedUsers.length,
                skippedDetails: skippedUsers
            });

        } catch (error) {
            await connection.rollback();
            console.error("[Error] addCommunityMember:", error);
            return res.status(500).json({ message: "Failed to add users to the community.", error: error.message });
        } finally {
            connection.release();
        }
    });
};

// API FOR ADMIN TO REMOVE A USER FROM A COMMUNITY
export const removeCommunityMember = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const adminId = req.user.id;
            const { communityId, userIdToRemove } = req.params;

            // CHECK PERMISSIONS
            const [adminCheck] = await db.promise().query("SELECT isAdmin FROM community_members WHERE communityId = ? AND userId = ?", [communityId, adminId]);
            if (adminCheck.length === 0 || !adminCheck[0].isAdmin) {
                return res.status(403).json({ message: "You must be an admin to remove members." });
            }

            // PREVENT REMOVING YOURSELF VIA THIS ENDPOINT
            if (Number(adminId) === Number(userIdToRemove)) {
                return res.status(400).json({ message: "Admins cannot remove themselves. Please use the 'Leave Community' option instead." });
            }

            // CHECK IF COMMUNITY/CREATOR EXISTS
            const [communityData] = await db.promise().query("SELECT creatorId FROM communities WHERE id = ?", [communityId]);
            if (communityData.length === 0) {
                return res.status(404).json({ message: "Community not found." });
            }

            // PREVENT REMOVING THE ORIGINAL CREATOR
            if (Number(communityData[0].creatorId) === Number(userIdToRemove)) {
                return res.status(403).json({ message: "The original creator of the community cannot be removed." });
            }

            // REMOVE USER FROM community_members
            const [removeResult] = await db.promise().query("DELETE FROM community_members WHERE communityId = ? AND userId = ?", [communityId, userIdToRemove]);
            if (removeResult.affectedRows === 0) {
                return res.status(404).json({ message: "User is not a member of this community." });
            }

            // REMOVE USER FROM ALL CHAT GROUPS WITHIN THAT COMMUNITY
            const [userChatGroups] = await db.promise().query(
                `SELECT cgm.chatGroupId FROM chat_group_members cgm JOIN \`chat_groups\` cg ON cgm.chatGroupId = cg.id WHERE cg.communityId = ? AND cgm.userId = ?`,
                [communityId, userIdToRemove]
            );

            if (userChatGroups.length > 0) {
                const chatGroupIdsToLeave = userChatGroups.map(g => g.chatGroupId);
                await db.promise().query("DELETE FROM chat_group_members WHERE userId = ? AND chatGroupId IN (?)", [userIdToRemove, chatGroupIdsToLeave]);
            }

            // Optionally, notify the removed user
            const {username: adminUsername} = req.user;
            const [community] = await db.promise().query("SELECT title FROM communities WHERE id = ?", [communityId]);
            await createNotification(
                'COMMUNITY_REMOVED',
                adminId, 
                userIdToRemove,
                { communityId },
                { communityTitle: community[0].title, adminUsername: adminUsername }
            );

            return res.status(200).json({ message: "User removed from the community successfully." });

        } catch (error) {
            console.error("[Error] removeCommunityMember:", error);
            return res.status(500).json({ message: "Failed to remove user from the community.", error: error.message });
        }
    });  
};