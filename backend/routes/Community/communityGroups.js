import express from "express";
import {
    createGroup,
    editGroup,
    deleteGroup,
    getGroupDetails,
    joinChatGroup,
    leaveChatGroup,
    getCommunityChatGroups,
    getMyChatGroupsInCommunity
} from "../../controllers/community/communityGroups.js";
import {
    fetchGroupMessages,
    editMessage,
    deleteMessage,
    uploadMessageMedia,
    uploadSingle
} from "../../controllers/community/interactions/messages.js"; // message interaction controllers

const router = express.Router();

router.post('/:communityId/new-group', createGroup); 
router.put('/:chatGroupId', editGroup);
router.delete('/:chatGroupId', deleteGroup);
router.get('/community/:communityId/all-groups', getCommunityChatGroups);
router.get('/community/:communityId/my-groups', getMyChatGroupsInCommunity); 
// Get details of a specific chat group
router.get('/:chatGroupId', getGroupDetails); 

// --- USER MEMBERSHIP IN CHAT GROUPS ---
router.post('/join/:chatGroupId', joinChatGroup);
router.delete('/:chatGroupId/leave', leaveChatGroup);

// --- MESSAGE INTERACTIONS WITHIN CHAT GROUPS 
// Path: /api/v1/communities/groups/messages
router.get('/messages/:chatGroupId', fetchGroupMessages); 
router.post("/messages/upload", uploadSingle, uploadMessageMedia);// Upload media for a message
router.put('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);

export default router;