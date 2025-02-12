import express from "express";
import {createCommunity, joinCommunity, communities, getCommunityDetails, yourCommunities, exitCommunity, deleteCommunity} from "../../controllers/community/community.js";

const router = express.Router();

router.post('/create', createCommunity);
router.get('/', communities );
router.get('/:id', getCommunityDetails );
router.get('/existing/joined', yourCommunities );
router.post('/join/:id', joinCommunity);
router.delete('/leave/:id', exitCommunity)
router.delete('/:id', deleteCommunity);

export default router