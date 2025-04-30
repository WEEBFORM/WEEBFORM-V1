import express from "express";
import { deleteCommunityPost, fetchCommunityPosts, newCommunityPost } from "../../controllers/community/interactions/main.js";
import { fetchGroupMessages, editMessage, deleteMessage, uploadMessageMedia, uploadSingle } from "../../controllers/community/interactions/messages.js";
import authenticateUser from "../../middlewares/verify.mjs";

const router = express.Router();

router.post('/:id/new-post', newCommunityPost);
router.get('/:id/community-feed', fetchCommunityPosts );
router.get('/:groupId', fetchGroupMessages );
router.post("/messages/upload", authenticateUser, uploadSingle, uploadMessageMedia); 
router.put('/messages/:messageId', editMessage );
router.delete('/messages/:messageId', deleteMessage );
router.delete('/community-feed/:id', deleteCommunityPost);

export default router