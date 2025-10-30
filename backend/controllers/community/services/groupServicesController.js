import { 
    getGroupLeaderboard as getLeaderboardService, 
    getUserLevelProgress as getProgressService, 
    getUserStats 
} from './gamificationService.js';
import { fetchAndProcessUserData } from '../../../config/userQueries.js';
import { db } from '../../../config/connectDB.js';

//FETCH GROUP MEMBERS
export const getGroupMembers = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        console.log(`[DEBUG] Fetching members for chatGroupId: ${chatGroupId} (Type: ${typeof chatGroupId})`);

        // Get the communityId from the chatGroupId
        const communityQuery = 'SELECT communityId FROM chat_groups WHERE id = ?';
        const [chatGroupRows] = await db.promise().query(communityQuery, [chatGroupId]);

        if (chatGroupRows.length === 0) {
            return res.status(404).json({ message: "Chat group not found." });
        }
        const communityId = chatGroupRows[0].communityId;
        console.log(`[DEBUG] Found communityId: ${communityId} for chatGroupId: ${chatGroupId}`);

        // Fetch userIds and their admin status using a JOIN.
        const memberQuery = `
            SELECT
                cgm.userId,
                cm.isAdmin
            FROM
                chat_group_members AS cgm
            INNER JOIN
                community_members AS cm ON cgm.userId = cm.userId
            WHERE
                cgm.chatGroupId = ? AND cm.communityId = ?
        `;
        const [memberRows] = await db.promise().query(memberQuery, [chatGroupId, communityId]);

        console.log(`[DEBUG] Query returned ${memberRows.length} member rows.`);
        
        if (memberRows.length === 0) {
            return res.status(200).json([]);
        }

        // Create an array of promises to fetch info for each member
        const memberDataPromises = memberRows.map(member => {
            return Promise.all([
                fetchAndProcessUserData(member.userId),
                getUserStats(member.userId, chatGroupId)
            ]);
        });

        // Use Promise.allSettled to prevent one failure from crashing the whole process
        const results = await Promise.allSettled(memberDataPromises);

        const members = [];
        // Loop through the results of allSettled
        for (const [index, result] of results.entries()) { // Using .entries() to get index
            if (result.status === 'fulfilled') {
                const [userInfo, userStats] = result.value;
                if (userInfo) {
                    // Add the 'isAdmin' value from our initial JOIN query
                    members.push({
                        ...userInfo,
                        stats: userStats,
                        isAdmin: memberRows[index].isAdmin
                    });
                } else {
                    console.warn(`[WARN] User info not found for a member, skipping.`); 
                }
            } else {
                console.error('[ERROR] Failed to fetch data for a member:', result.reason);
            }
        }

        res.status(200).json(members);

    } catch (error) {
        console.error("Error in getGroupMembers controller:", error);
        res.status(500).json({ message: "Failed to fetch group members", error: error.message });
    }
};


//FETCH GROUP LEADERBOARD
export const getGroupLeaderboard = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        const leaderboard = await getLeaderboardService(chatGroupId);
        res.status(200).json(leaderboard);
    } catch (error) {
        console.error("Error in getGroupLeaderboard controller:", error);
        res.status(500).json({ message: "Failed to fetch leaderboard", error: error.message });
    }
};

//FETCH USER PROGRESS IN GROUP
export const getUserProgressInGroup = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        const userId = req.user.id; // From `authenticateUser` middleware
        const progress = await getProgressService(userId, chatGroupId);
        res.status(200).json(progress);
    } catch (error){
        console.error("Error in getUserProgressInGroup controller:", error);
        res.status(500).json({ message: "Failed to fetch user progress", error: error.message });
    }
};