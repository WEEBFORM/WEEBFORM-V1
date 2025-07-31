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

        const memberQuery = 'SELECT userId FROM chat_group_members WHERE chatGroupId = ?';
        const [memberRows] = await db.promise().query(memberQuery, [chatGroupId]);

        console.log(`[DEBUG] Query returned ${memberRows.length} member rows.`);
        
        if (memberRows.length === 0) {
            return res.status(200).json([]);
        }

        const memberIds = memberRows.map(row => row.userId);

        // Create an array of promises to fetch info for each member
        const memberDataPromises = memberIds.map(userId => {
            return Promise.all([
                fetchAndProcessUserData(userId),
                getUserStats(userId, chatGroupId)
            ]);
        });

        // Use Promise.allSettled to prevent one failure from crashing the whole process
        const results = await Promise.allSettled(memberDataPromises);

        const members = [];
        // Loop through the results of allSettled
        for (const result of results) {
            if (result.status === 'fulfilled') {
                // The promise was successful
                const [userInfo, userStats] = result.value;
                if (userInfo) { // Check if user info was found
                    members.push({
                        ...userInfo,
                        stats: userStats
                    });
                } else {
                    console.warn(`[WARN] User info not found for a member, skipping.`); 
                }
            } else {
                // A promise was rejected. Log the error but don't crash.
                console.error('[ERROR] Failed to fetch data for a member:', result.reason);
            }
        }

        res.status(200).json(members);

    } catch (error) {
        // This outer catch will now handle any truly unexpected errors
        console.error("Error in getGroupMembers controller:", error);
        res.status(500).json({ message: "Failed to fetch group members", error: error.message });
    }
};


//FETCH GROUP LEADERBOARD
export const getGroupLeaderboard = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        const limit = req.query.limit || 20; // Allow client to specify limit, default to 20
        const leaderboard = await getLeaderboardService(chatGroupId, parseInt(limit));
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