import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";
import moment from "moment";
import { cpUpload } from "../../middlewares/storage.js";
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";
import { fetchCommunityInfo, getUserJoinedCommunityIds, getFriendCommunityIds } from "./communityHelpers.js" 
import { joinChatGroupInternal } from './communityGroups.js';//HELPER FUNCTION FOR JOINING CHAT GROUPS

// --- API TO CREATE NEW COMMUNITY ---
export const createCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        cpUpload(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                console.error("[Multer Error] File upload error during community creation:", err);
                return res.status(500).json({ message: "File upload error", error: err.message });
            } else if (err) {
                console.error("[Multer Error] Unknown file upload error during community creation:", err);
                return res.status(500).json({ message: "Unknown error during file upload", error: err.message });
            }

            try {
                const user = req.user;
                const title = req.body.title;

                if (!title) {
                    console.warn("[Community Create] Community title is required for user:", user.username);
                    return res.status(400).json({ message: "Community title is required" });
                }

                const checkCommunityExistsQuery = "SELECT id FROM communities WHERE title = ?";
                db.query(checkCommunityExistsQuery, [title], async (err, data) => {
                    if (err) {
                        console.error("[DB Error] Database error checking community existence during creation:", err);
                        return res.status(500).json({ message: "Database error", error: err.message });
                    }
                    if (data && data.length) {
                        console.warn(`[Community Create] Community with title '${title}' already exists.`);
                        return res.status(409).json({ message: "Community already exists" });
                    }

                    // UPLOAD TO S3
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
                            console.log(`[S3] Community icon uploaded for '${title}': ${groupIconUrl}`);
                        } catch (uploadError) {
                            console.error("[S3 Error] Error uploading community icon to S3:", uploadError);
                            return res.status(500).json({ message: "Error uploading community icon", error: uploadError.message });
                        }
                    } else {
                        console.warn("Community image (groupIcon) is required.");
                        return res.status(400).json({ message: "Community image is required" });
                    }

                    const description = req.body.description || `Welcome to ${title}'s Official Community on Weebform.`;
                    const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");

                    //Step 3: INSERT INTO `communities` TABLE
                    const createCommunityQuery = "INSERT INTO communities (`creatorId`, `title`, `description`, `groupIcon`, `createdAt`) VALUES (?)";
                    const communityValues = [user.id, title, description, groupIconUrl, timestamp];

                    db.query(createCommunityQuery, [communityValues], (err, communityResult) => {
                        if (err) {
                            console.error("[DB Error] Error creating community record in DB:", err);
                            return res.status(500).json({ message: "Error creating community", error: err.message });
                        }
                        const communityId = communityResult.insertId;
                        console.log(`[Community Create] Community '${title}' created with ID: ${communityId}`);

                        // Step 4: ADD CREATOR AS COMMUNITY MEMBER FIRST
                        const addCreatorAsMemberQuery = "INSERT INTO community_members (`communityId`, `userId`, `isAdmin`) VALUES (?, ?, ?)";
                        const memberValues = [communityId, user.id, 1]; // 1 indicates admin

                        db.query(addCreatorAsMemberQuery, memberValues, (memberErr, memberResult) => {
                            if (memberErr) {
                                console.error("[DB Error] Error adding creator as community member:", memberErr);
                                return res.status(500).json({ message: "Community created but failed to add creator as member", error: memberErr.message });
                            }
                            console.log(`[Community Create] Creator ${user.username} added as 'admin member' to community with id: ${communityId}.`);

                            //CREATE DEFAULT CHAT GROUPS FOR NEW COMMUNITY IN `chat_groups` TABLE
                            const defaultChatGroups = [
                                { title: `${title} General Chat`, type: 'text', isDefault: true, groupIcon: null },
                                { title: `${title} Filler arc / Banned`, type: 'filler', isDefault: true, groupIcon: null }
                            ];

                            const createGroupsQuery = "INSERT INTO `chat_groups` (`name`, `communityId`, `type`, `isDefault`, `groupIcon`, `createdAt`) VALUES ?";
                            const groupValues = defaultChatGroups.map(group => [
                                group.title,
                                communityId,
                                group.type,
                                group.isDefault ? 1 : 0,
                                group.groupIcon,
                                timestamp
                            ]);

                            db.query(createGroupsQuery, [groupValues], async (groupErr, groupResult) => {
                                if (groupErr) {
                                    console.error("[DB Error] Error creating default chat groups:", groupErr)
                                    // This is also critical, respond with an error
                                    return res.status(500).json({ message: "Community created, but failed to create default chat groups.", error: groupErr.message });
                                }
                                console.log(`[Community Create] Created ${defaultChatGroups.length} default chat groups for community ${communityId}.`);

                                // Automatically add the COMMUNITY CREATOR to the newly created DEFAULT CHAT GROUPS
                                // These are chat groups, so membership is in `chat_group_members`.
                                const firstCreatedGroupId = groupResult.insertId;
                                const createdGroupIds = [];
                                for (let i = 0; i < defaultChatGroups.length; i++) {
                                    createdGroupIds.push(firstCreatedGroupId + i);
                                }

                                try {
                                    for (const chatGroupId of createdGroupIds) {
                                        await joinChatGroupInternal(user.id, chatGroupId); //IMPORTED HELPER FUNCTION
                                        console.log(`[Community Create] Creator ${user.id} automatically joined chat group ${chatGroupId}.`);
                                    }
                                } catch (autoJoinCreatorErr) {
                                    console.error("[Error] Error automatically joining creator to default chat groups (non-blocking for community creation):", autoJoinCreatorErr);
                                }

                                return res.status(201).json({
                                    message: "Community, default chat groups, and creator membership successfully established.",
                                    communityId: communityId
                                });
                            });
                        });
                    });
                });
            } catch (error) {
                console.error("[Unexpected Error] An unexpected error occurred in createCommunity:", error);
                return res.status(500).json({ message: "An unexpected error occurred", error: error.message });
            }
        });
    });
};

// --- API TO VIEW JOINED COMMUNITIES (Community-level) ---
export const yourCommunities = (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        console.log(`[Community API] Fetching communities joined by user ${userId}.`);

        try {
            // GET JOINED COMMUNITY IDs
            const joinedCommunityIds = await getUserJoinedCommunityIds(userId);

            if (joinedCommunityIds.length === 0) {
                console.log(`[Community API] User ${userId} has not joined any communities.`);
                return res.status(404).json({ message: "You haven't joined a community." });
            }

            // FETCH COMMUNITY INFO FOR JOINED COMMUNITIES
            const communities = await fetchCommunityInfo(joinedCommunityIds, userId, {
                includeMemberCount: true,
                includeUserMembership: false, // Not needed here, as we know these are joined communities
            });

            console.log(`[Community API] Fetched ${communities.length} joined communities for user ${userId}.`);
            res.status(200).json(communities);
        } catch (error) {
            console.error("[DB Error] Error fetching joined communities:", error);
            return res.status(500).json({ message: "Database error fetching joined communities." });
        }
    });
}

// --- API TO VIEW ALL COMMUNITIES (categorized) ---
export const communities = (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const section = req.query.section; // e.g., recommended, popular, explore, joined
        console.log(`[Community API] Fetching communities for user ${userId}. Section: ${section || 'all sections'}`);

        try {
            //FETCH ALL COMMUNITIES DATA
            const allCommunitiesData = await fetchCommunityInfo([], userId, {
                includeMemberCount: true,
                includeUserMembership: true,
                includeCreatorInfo: false,
                includeChatGroups: false
            });

            //FETCH COMMUNITIES WHERE FRIENDS ARE MEMBERS
            const friendCommunityIds = await getFriendCommunityIds(userId);
            const friendCommunityIdsSet = new Set(friendCommunityIds);

            let recommendedResult = [];
            let popularResult = [];
            let othersResult = [];
            let joinedResult = [];

            const processedIds = new Set(); // Tracks IDs already assigned to a category (joined or discovery)

            // 3. Separate joined communities and add their IDs to processedIds
            // These are excluded from discovery sections (recommended, popular, others)
            allCommunitiesData.forEach(community => {
                if (community.isCommunityMember) { // isCommunityMember comes from fetchCommunityInfo
                    joinedResult.push(community);
                    processedIds.add(community.id);
                }
            });
            console.log(`[Community API] User ${userId} has joined ${joinedResult.length} communities.`);

            //RECOMMENDED
            allCommunitiesData.forEach(community => {
                if (!processedIds.has(community.id) && friendCommunityIdsSet.has(community.id)) {
                    recommendedResult.push(community);
                    processedIds.add(community.id); // Mark as processed for discovery sections
                }
            });
            console.log(`[Community API] Found ${recommendedResult.length} recommended (and not joined) communities.`);

            //POPULAR COMMUNITIES
            const popularCandidates = allCommunitiesData
                .filter(community => !processedIds.has(community.id))
                .sort((a, b) => b.memberCount - a.memberCount);

            const popularLimit = 5;
            popularCandidates.slice(0, popularLimit).forEach(community => {
                popularResult.push(community);
                processedIds.add(community.id); 
            });
            console.log(`[Community API] Found ${popularResult.length} popular communities (from remaining).`);

            //OTHERS (remaining communities not in recommended or popular)
            allCommunitiesData.forEach(community => {
                if (!processedIds.has(community.id)) {
                    othersResult.push(community);
                }
            });
            console.log(`[Community API] Found ${othersResult.length} other communities for exploration.`);

            //CATEGORIZED DATA
            if (section === 'recommended') {
                return res.status(200).json({ section: 'recommended', communities: recommendedResult });
            } else if (section === 'popular') {
                return res.status(200).json({ section: 'popular', communities: popularResult });
            } else if (section === 'explore' || section === 'others') {
                return res.status(200).json({ section: 'explore', communities: othersResult });
            } else if (section === 'joined') { yourCommunities
                return res.status(200).json({ section: 'joined', communities: joinedResult });
            } else {
                return res.status(200).json({
                    recommended: recommendedResult,
                    popular: popularResult,
                    others: othersResult,
                    // Optionally include joined communities:
                    // joined: joinedResult
                });
            }

        } catch (error) {
            console.error("[Community API Error] Error in communities API:", error);
            return res.status(500).json({ message: "An unexpected error occurred while fetching communities.", error: error.message });
        }
    });
};

// --- API TO VIEW SPECIFIC COMMUNITY DETAILS ---
export const getCommunityDetails = (req, res) => {
    authenticateUser(req, res, async () => {
        const communityId = req.params.id;
        const userId = req.user.id;

        console.log(`[Community API] Fetching details for community ${communityId} for user ${userId}.`);

        if (!communityId) {
            console.warn("[Community API] Community ID is required for getCommunityDetails.");
            return res.status(400).json({ error: "Community ID is required." });
        }

        try {
            // FETCH COMMUNITY DETAILS WITH ALL REQUIRED INFO
            const communities = await fetchCommunityInfo([communityId], userId, {
                includeMemberCount: true,
                includeUserMembership: true,
                includeChatGroups: true,
                includeCreatorInfo: true
            });

            if (communities.length === 0) {
                console.warn(`[Community API] Community ${communityId} not found.`);
                return res.status(404).json({ error: "Community not found." });
            }

            const community = communities[0];
            console.log(`[Community API] Fetched ${community.chatGroups?.length || 0} chat groups for community ${communityId}.`);

            res.status(200).json(community);
        } catch (error) {
            console.error("[DB Error] Error fetching community details:", error);
            return res.status(500).json({ message: "Database error fetching community details." });
        }
    });
};

// --- JOIN COMMUNITY (User joins the overall community) ---
export const joinCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const communityId = req.params.id;

        console.log(`[Community Controller] User ${user.username} attempting to join community with id: ${communityId}.`);

        // VERIFY MEMBERSHIP
        const checkMembershipQuery = "SELECT id FROM community_members WHERE communityId = ? AND userId = ?";

        db.query(checkMembershipQuery, [communityId, user.id], (err, results) => {
            if (err) {
                console.error("[DB Error] Error checking community membership before joining:", err);
                return res.status(500).json({ message: "Internal server error checking community membership." });
            }
            if (results.length > 0) {
                console.log(`[Community] User ${user.username} is already a member of community ${communityId}.`);
                return res.status(409).send({ message: "You are already a member of this community." });
            }

            // ADD USER TO COMMUNITY AS REGULAR MEMBER
            const joinCommunityQuery = "INSERT INTO community_members (`communityId`, `userId`, `isAdmin`) VALUES (?, ?, ?)";
            db.query(joinCommunityQuery, [communityId, user.id, 0], async (err, data) => {
                if (err) {
                    console.error("[DB Error] Error inserting user into community members (community membership):", err);
                    return res.status(500).json({ message: "Failed to join community." });
                }
                console.log(`[Community] User ${user.id} successfully joined community ${communityId}.`);

                try {
                    const defaultGroupsQuery = "SELECT id FROM `chat_groups` WHERE communityId = ? AND isDefault = TRUE";
                    const [defaultGroups] = await db.promise().query(defaultGroupsQuery, [communityId]);

                    if (defaultGroups.length > 0) {
                        const defaultGroupIds = defaultGroups.map(g => g.id);
                        console.log(`[Community] Found default chat groups for community ${communityId}: ${defaultGroupIds.join(', ')}`);
                        for (const chatGroupId of defaultGroupIds) {
                            await joinChatGroupInternal(user.id, chatGroupId);
                            console.log(`[Community] User ${user.username} automatically joined default chat group with the id: ${chatGroupId}.`);
                        }
                    } else {
                        console.log(`[Community] No default chat groups found for community ${communityId} to auto-join.`);
                    }
                } catch (autoJoinErr) {
                    console.error("[Error] Error during automatic default chat group join (non-blocking):", autoJoinErr);
                }
                const communityTitleQuery = "SELECT title FROM communities WHERE id = ?";
                db.query(communityTitleQuery, [communityId], (err, communityResult) => {
                    if (err) {
                        console.error("[DB Error] Error fetching community title after join:", err);
                        return res.status(500).json({ message: "Joined community, but error fetching community name." });
                    }
                    const communityTitle = communityResult.length > 0 ? communityResult[0].title : 'Unknown Community';
                    const userName = user.full_name || user.username || `User ${user.id}`;
                    return res.status(200).json({ message: `${userName} has joined the community: ${communityTitle}`, communityId, userId: user.id });
                });
            });
        });
    });
};

// --- LEAVE COMMUNITY ---
export const exitCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const communityId = req.params.id; //:communityId

        console.log(`[Community Controller] User ${user.id} attempting to exit community ${communityId}.`);

        if (!communityId) {
            console.warn("[Community Exit] Community ID is required.");
            return res.status(400).json({ message: "Community ID is required." });
        }

        // VERIFY MEMBERSHIP IN community_members TABLE
        const membershipCheckQuery = `
            SELECT u.username, c.title
            FROM community_members cm
            JOIN users u ON cm.userId = u.id
            JOIN communities c ON cm.communityId = c.id
            WHERE cm.userId = ? AND cm.communityId = ?
        `;

        db.query(membershipCheckQuery, [user.id, communityId], (checkErr, checkResult) => {
            if (checkErr) {
                console.error("[DB Error] Error checking community membership before exit:", checkErr);
                return res.status(500).json({ message: "Database error checking membership.", error: checkErr.message });
            }

            if (checkResult.length === 0) {
                console.warn(`[Community Exit] User ${user.id} was not a member of community ${communityId}.`);
                return res.status(404).json({ message: "Membership not found or invalid community. You are not a member." });
            }

            const username = checkResult[0].username;
            const communityTitle = checkResult[0].title;

            //DELETE USER FROM community_members TABLE
            const exitCommunityQuery = "DELETE FROM `community_members` WHERE communityId = ? AND userId = ?";
            db.query(exitCommunityQuery, [communityId, user.id], async (exitErr, exitResult) => {
                if (exitErr) {
                    console.error("[DB Error] Error deleting community membership:", exitErr);
                    return res.status(500).json({ message: "Error leaving community", error: exitErr.message });
                }

                if (exitResult.affectedRows === 0) {
                    console.warn(`[Community Exit] No community membership record deleted for user ${user.id} in community ${communityId}.`);
                    return res.status(404).json({ message: "You are not a member of this community (already left or never joined)." });
                }
                console.log(`[Community Exit] User ${user.id} successfully left community ${communityId}.`);

                // Step 3: AUTOMATICALLY REMOVE USER FROM CHAT GROUPS WITHIN COMMUNITY
                try {
                    const userChatGroupsInCommunityQuery = `
                        SELECT cgm.chatGroupId FROM chat_group_members cgm
                        JOIN \`chat_groups\` cg ON cgm.chatGroupId = cg.id
                        WHERE cg.communityId = ? AND cgm.userId = ?
                    `;
                    const [userChatGroups] = await db.promise().query(userChatGroupsInCommunityQuery, [communityId, user.id]);

                    if (userChatGroups.length > 0) {
                        const chatGroupIdsToLeave = userChatGroups.map(g => g.chatGroupId);
                        console.log(`[Community Exit] User ${user.id} leaving ${chatGroupIdsToLeave.length} chat groups in community ${communityId}.`);
                        await db.promise().query("DELETE FROM chat_group_members WHERE userId = ? AND chatGroupId IN (?)", [user.id, chatGroupIdsToLeave]);
                    } else {
                        console.log(`[Community Exit] User ${user.id} was not a member of any chat groups in community ${communityId}.`);
                    }
                } catch (autoLeaveErr) {
                    console.error("[Error] Error during automatic chat group leave on community exit (non-blocking):", autoLeaveErr);
                }

                const userName = user.full_name || user.username || `User ${user.id}`;
                return res.status(200).json({ message: `${userName} has successfully left the community: ${communityTitle}` });
            });
        });
    });
};

// --- API TO DELETE COMMUNITY --- 
export const deleteCommunity = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        const communityId = req.params.id; // :communityId

        console.log(`[Community Delete] User ${user.id} attempting to delete community ${communityId}.`);

        // VERIFY PRIVILEGES
        const getCommunityQuery = "SELECT groupIcon FROM communities WHERE id = ? AND creatorId = ?";
        db.query(getCommunityQuery, [communityId, user.id], async (err, data) => {
            if (err) {
                console.error("[DB Error] Error fetching community for deletion verification:", err);
                return res.status(500).json({ message: "Database query error", error: err.message });
            }
            if (data.length === 0) {
                console.warn(`[Community Delete] Community ${communityId} not found or user ${user.id} is not the creator.`);
                return res.status(404).json({ message: "Community not found or you are not authorized to delete it." });
            }

            const { groupIcon } = data[0];

            // Helper function for S3 deletion
            const deleteS3Object = async (url) => {
                const key = s3KeyFromUrl(url);
                if (!key) { console.warn(`[S3 Helper] Invalid S3 object URL for deletion (skipped): ${url}`); return; }
                try {
                    const deleteCommand = new DeleteObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key });
                    await s3.send(deleteCommand);
                    console.log(`[S3 Helper] S3 object deleted successfully: ${key}`);
                } catch (s3Error) {
                    console.error(`[S3 Error] Error deleting S3 object ${key}:`, s3Error);
                    throw new Error("Error deleting file from S3");
                }
            };

            // DELETE ALL ASSOCIATES S3 OBJECTS
            try {
                if (groupIcon) { await deleteS3Object(groupIcon); } 
                const chatGroupIconsQuery = "SELECT groupIcon FROM `chat_groups` WHERE communityId = ? AND groupIcon IS NOT NULL";
                const [chatGroupIcons] = await db.promise().query(chatGroupIconsQuery, [communityId]);
                for (const group of chatGroupIcons) { await deleteS3Object(group.groupIcon); }
                console.log(`[S3] All associated community and chat group icons for community ${communityId} processed for deletion.`);
            } catch (deleteError) {
                console.error("[S3 Error] Fatal error during S3 object deletion for community:", deleteError);
                return res.status(500).json({ message: "Error deleting associated files from storage.", error: deleteError.message });
            }

            // Step 3: Delete the community record from the `communities` table
            // Due to CASCADE DELETE foreign keys, this should automatically delete:
            // - entries in `community_members` for this community
            // - entries in `chat_groups` belonging to this community
            // - entries in `chat_group_members` for those chat groups
            // - entries in `communityposts` for this community
            // - entries in `likes` for community posts in this community
            // - entries in `groupmessages` (and related reactions/threads) for chat groups in this community
            // - entries in `user_activity` and `user_level_history` for chat groups in this community
            // - entries in `moderation_actions` for chat groups in this community
            const deleteCommunityQuery = "DELETE FROM communities WHERE id = ? AND creatorId = ?";
            db.query(deleteCommunityQuery, [communityId, user.id], (err, result) => {
                if (err) {
                    console.error("[DB Error] Database deletion error for community:", err);
                    return res.status(500).json({ message: "Database deletion error", error: err.message });
                }
                if (result.affectedRows > 0) {
                    console.log(`[Community Delete] Community ${communityId} deleted successfully by creator ${user.id}.`);
                    return res.status(200).json({ message: "Community deleted successfully." });
                } else {
                    // This scenario should ideally be caught by the prior `getCommunityQuery`
                    console.warn(`[Community Delete] User ${user.id} could not delete community ${communityId} (not creator or community not found).`);
                    return res.status(403).json({ message: "You can only delete your own community." });
                }
            });
        });
    });
};

// --- RELEVANT FUNCTIONS (No changes, helper only) ---
const shuffleComs = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};