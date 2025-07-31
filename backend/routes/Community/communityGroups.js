import express from "express";

// --- CORE & MESSAGE CONTROLLERS ---
import {
    createGroup, editGroup, deleteGroup, getGroupDetails,
    joinChatGroup, leaveChatGroup, getCommunityChatGroups, getMyChatGroupsInCommunity
} from "../../controllers/community/communityGroups.js";
import {
    fetchGroupMessages, editMessage, deleteMessage,
    uploadMessageMedia, uploadSingle
} from "../../controllers/community/interactions/messages.js";

// --- MIDDLEWARE ---
import { authenticateUser } from "../../middlewares/verify.mjs";
import { isCommunityAdmin } from "../../controllers/community/communityGroups.js";

// --- NEW SERVICE CONTROLLERS ---
import {
    getGroupMembers, getGroupLeaderboard, getUserProgressInGroup
} from "../../controllers/community/services/groupServicesController.js";
import {
    muteUserInGroup, exileUserInGroup, removeUserFromGroup, applyGroupSlowMode
} from "../../controllers/community/services/groupModerationController.js";

const router = express.Router();

// --- CORE GROUP MANAGEMENT ---
router.post('/:communityId/new-group', authenticateUser, createGroup);
router.put('/:chatGroupId', authenticateUser, isCommunityAdmin, editGroup);
router.delete('/:chatGroupId', authenticateUser, isCommunityAdmin, deleteGroup);
router.get('/community/:communityId/all-groups', getCommunityChatGroups);
router.get('/community/:communityId/my-groups', authenticateUser, getMyChatGroupsInCommunity);
router.get('/:chatGroupId', getGroupDetails);

// --- USER MEMBERSHIP ---
router.post('/join/:chatGroupId', authenticateUser, joinChatGroup);
router.delete('/:chatGroupId/leave', authenticateUser, leaveChatGroup);

// --- GAMIFICATION & MEMBER INFO ---
router.get('/:chatGroupId/members', getGroupMembers); 
router.get('/:chatGroupId/leaderboard', getGroupLeaderboard);
router.get('/:chatGroupId/my-progress', authenticateUser, getUserProgressInGroup);

// --- GROUP-LEVEL MODERATION (For Admins/Mods) ---
router.post('/:chatGroupId/moderation/mute', authenticateUser, isCommunityAdmin, muteUserInGroup);
router.post('/:chatGroupId/moderation/exile', authenticateUser, isCommunityAdmin, exileUserInGroup);
router.post('/:chatGroupId/moderation/remove', authenticateUser, isCommunityAdmin, removeUserFromGroup);
router.post('/:chatGroupId/moderation/slow-mode', authenticateUser, isCommunityAdmin, applyGroupSlowMode);

// --- MESSAGE INTERACTIONS ---
router.get('/messages/:chatGroupId', authenticateUser, fetchGroupMessages);
router.post("/messages/upload", authenticateUser, uploadSingle, uploadMessageMedia);
router.put('/messages/:messageId', authenticateUser, editMessage);
router.delete('/messages/:messageId', authenticateUser, deleteMessage);

export default router;