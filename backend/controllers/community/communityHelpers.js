import { db } from "../../config/connectDB.js";
import { processImageUrl } from '../../middlewares/cloudfrontConfig.js';

// --- HELPER FUNCTION TO FETCH COMMUNITY INFO (Refactored) ---
export const fetchCommunityInfo = async (communityIds = [], userId = null, options = {}) => {
    const { includeMemberCount = true, includeUserMembership = false, includeChatGroups = false, includeCreatorInfo = false } = options;

    try {
        let baseQuery = `SELECT c.id, c.creatorId, c.title, c.description, c.groupIcon, c.createdAt`;
        if (includeMemberCount) baseQuery += `,(SELECT COUNT(*) FROM community_members WHERE communityId = c.id) AS memberCount`;
        if (includeUserMembership && userId) baseQuery += `, (SELECT COUNT(*) FROM community_members WHERE communityId = c.id AND userId = ?) > 0 AS isCommunityMember`;
        if (includeCreatorInfo) baseQuery += `, u.username AS creatorUsername, u.full_name AS creatorFullName`;
        baseQuery += ` FROM communities AS c`;
        if (includeCreatorInfo) baseQuery += ` LEFT JOIN users u ON c.creatorId = u.id`;
        
        const queryParams = [];
        if (includeUserMembership && userId) queryParams.push(userId);
        if (communityIds.length > 0) {
            baseQuery += ` WHERE c.id IN (?)`;
            queryParams.push(communityIds);
        }
        baseQuery += ` ORDER BY c.createdAt ASC`;

        const [communities] = await db.promise().query(baseQuery, queryParams);

        const processedCommunities = communities.map(community => {
            community.groupIcon = processImageUrl(community.groupIcon);
            return community;
        });

        if (includeChatGroups && processedCommunities.length > 0) {
            for (const community of processedCommunities) {
                const chatGroupsQuery = `
                    SELECT cg.id, cg.name, cg.groupIcon, cg.type, cg.isDefault, cg.createdAt,
                           (SELECT COUNT(*) FROM chat_group_members WHERE chatGroupId = cg.id) AS memberCount
                           ${userId ? `,(SELECT COUNT(*) FROM chat_group_members WHERE chatGroupId = cg.id AND userId = ?) > 0 AS isJoined` : ''}
                    FROM \`chat_groups\` AS cg WHERE cg.communityId = ? ORDER BY cg.name`;

                const chatGroupParams = userId ? [userId, community.id] : [community.id];
                const [chatGroups] = await db.promise().query(chatGroupsQuery, chatGroupParams);

                community.chatGroups = chatGroups.map(group => {
                    group.groupIcon = processImageUrl(group.groupIcon);
                    return group;
                });
            }
        }

        return processedCommunities;
    } catch (error) {
        console.error("[Helper Error] Error in fetchCommunityInfo:", error);
        throw new Error("Error fetching community information");
    }
};

// --- HELPER FUNCTION TO GET USER'S JOINED COMMUNITY IDS ---
export const getUserJoinedCommunityIds = async (userId) => {
    try {
        const [results] = await db.promise().query(`SELECT communityId FROM community_members WHERE userId = ?`, [userId]);
        return results.map(row => row.communityId);
    } catch (error) {
        console.error("[Helper Error] Error fetching user joined communities:", error);
        throw new Error("Error fetching user communities");
    }
};

// --- HELPER FUNCTION TO GET FRIEND COMMUNITY IDS ---
export const getFriendCommunityIds = async (userId) => {
    try {
        const [friendsResult] = await db.promise().query(`SELECT f.followed FROM reach f WHERE f.follower = ?`, [userId]);
        const followed = friendsResult.map(friend => friend.followed);
        if (followed.length === 0) return [];

        const [friendCommunitiesResult] = await db.promise().query(`SELECT DISTINCT cm.communityId FROM community_members cm WHERE cm.userId IN (?)`, [followed]);
        return friendCommunitiesResult.map(fc => fc.communityId);
    } catch (error) {
        console.error("[Helper Error] Error fetching friend communities:", error);
        throw new Error("Error fetching friend communities");
    }
};