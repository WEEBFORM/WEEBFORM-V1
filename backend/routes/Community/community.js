import express from "express";
import {
    createCommunity,
    joinCommunity,
    communities,
    getCommunityDetails,
    yourCommunities,
    getCreatedCommunities,
    exitCommunity,
    deleteCommunity,
    editCommunity,
    inviteToCommunity,
    acceptCommunityInvitation,
} from "../../controllers/community/community.js";
//COMMUNITY POST INTERACTIONS/FEATURES
import {
    newCommunityPost,
    fetchCommunityPosts,
    deleteCommunityPost
} from "../../controllers/community/interactions/main.js";

const router = express.Router();

//COMMUNITY MANAGEMENT (api/v1/communities)
router.post('/create', createCommunity);
router.get('/', communities);
router.get('/existing/joined', yourCommunities);
router.get('/existing/created', getCreatedCommunities);
router.get('/:id', getCommunityDetails);
router.post('/join/:id', joinCommunity);
router.delete('/leave/:id', exitCommunity);
router.put('/:id/edit', editCommunity);
router.delete('/:id', deleteCommunity);

router.post('/invite', inviteToCommunity);
router.post('/invite/accept', acceptCommunityInvitation);

//COMMUNITY FEED/POSTS 
router.post('/:id/new-post', newCommunityPost);
router.get('/:id/community-feed', fetchCommunityPosts);
router.delete('/community-feed/:id', deleteCommunityPost);

export default router; 