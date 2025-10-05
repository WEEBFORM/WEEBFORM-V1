import { db } from "../../config/connectDB.js";
import { s3, generateS3Url, s3KeyFromUrl } from "../../middlewares/S3bucketConfig.js";

// --- HELPER FUNCTION TO FETCH COMMUNITY INFO ---
export const fetchCommunityInfo = async (communityIds = [], userId = null, options = {}) => {
    const {
        includeMemberCount = true,
        includeUserMembership = false,
        includeChatGroups = false,
        includeCreatorInfo = false
    } = options;

    try {
        let baseQuery = `
            SELECT 
                c.id,
                c.creatorId,
                c.title,
                c.description,
                c.groupIcon,
                c.createdAt
        `;

        // Add member count if requested
        if (includeMemberCount) {
            baseQuery += `,
                (SELECT COUNT(*) FROM community_members WHERE communityId = c.id) AS memberCount`;
        }

        // Add user membership status if requested and userId provided
        if (includeUserMembership && userId) {
            baseQuery += `,
                CASE WHEN (SELECT COUNT(*) FROM community_members WHERE communityId = c.id AND userId = ?) > 0 
                THEN TRUE ELSE FALSE END AS isCommunityMember`;
        }

        // Add creator info if requested
        if (includeCreatorInfo) {
            baseQuery += `,
                u.username AS creatorUsername,
                u.full_name AS creatorFullName`;
        }

        baseQuery += `
            FROM communities AS c
        `;

        // Join with users table if creator info is needed
        if (includeCreatorInfo) {
            baseQuery += ` LEFT JOIN users u ON c.creatorId = u.id`;
        }

        let queryParams = [];
        
        // Add WHERE clause if specific community IDs are requested
        if (communityIds.length > 0) {
            baseQuery += ` WHERE c.id IN (?)`;
            queryParams.push(communityIds);
        }

        // Add userId parameter if user membership is being checked
        if (includeUserMembership && userId) {
            queryParams.unshift(userId); 
        }

        baseQuery += ` ORDER BY c.createdAt ASC`;

        // Execute the query
        const [communities] = await db.promise().query(baseQuery, queryParams);

        // Process S3 URLs for community icons
        const processedCommunities = await Promise.all(
            communities.map(async (community) => {
                if (community.groupIcon) {
                    try {
                        const groupIconKey = s3KeyFromUrl(community.groupIcon);
                        community.groupIcon = await generateS3Url(groupIconKey);
                    } catch (error) {
                        console.error(`[S3 Error] Error generating community icon URL for community ${community.id}:`, error);
                        community.groupIcon = null;
                    }
                }
                return community;
            })
        );

        // Add chat groups if requested
        if (includeChatGroups && processedCommunities.length > 0) {
            for (const community of processedCommunities) {
                const chatGroupsQuery = `
                    SELECT
                    cg.id,
                    cg.name,
                    cg.groupIcon,
                    cg.type,
                    cg.isDefault,
                    cg.createdAt,
                    (
                        SELECT COUNT(*) 
                        FROM chat_group_members 
                        WHERE chatGroupId = cg.id
                    ) AS memberCount
                    ${userId ? `,
                    CASE WHEN (SELECT COUNT(*) FROM chat_group_members WHERE chatGroupId = cg.id AND userId = ?) > 0 
                    THEN TRUE ELSE FALSE END AS isJoined` : ''}
                FROM
                    \`chat_groups\` AS cg
                WHERE
                    cg.communityId = ?
                ORDER BY cg.name
                `;

                const chatGroupParams = userId ? [userId, community.id] : [community.id];
                const [chatGroups] = await db.promise().query(chatGroupsQuery, chatGroupParams);

                // Process S3 URLs for chat group icons
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

                community.chatGroups = processedChatGroups;
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
        const query = `SELECT communityId FROM community_members WHERE userId = ?`;
        const [results] = await db.promise().query(query, [userId]);
        return results.map(row => row.communityId);
    } catch (error) {
        console.error("[Helper Error] Error fetching user joined communities:", error);
        throw new Error("Error fetching user communities");
    }
};

// --- HELPER FUNCTION TO GET FRIEND COMMUNITY IDS ---
export const getFriendCommunityIds = async (userId) => {
    try {
        // Get friends' IDs
        const friendsQuery = `SELECT f.followed FROM reach f WHERE f.follower = ?`;
        const [friendsResult] = await db.promise().query(friendsQuery, [userId]);
        const followed = friendsResult.map(friend => friend.followed);

        if (followed.length === 0) {
            return [];
        }

        // Get communities that friends are members of
        const friendsCommunitiesQuery = `
            SELECT DISTINCT cm.communityId
            FROM community_members cm
            WHERE cm.userId IN (?)
        `;
        const [friendCommunitiesResult] = await db.promise().query(friendsCommunitiesQuery, [followed]);
        return friendCommunitiesResult.map(fc => fc.communityId);
    } catch (error) {
        console.error("[Helper Error] Error fetching friend communities:", error);
        throw new Error("Error fetching friend communities");
    }
};