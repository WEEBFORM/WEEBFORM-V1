import express from "express";
import {createCommunity, joinCommunity, communities, yourCommunities, exitCommunity, deleteCommunity} from "../../controllers/community/communityInteractions/community.js";

const router = express.Router();

router.post('/create', createCommunity);
router.get('/', communities );
router.get('/user', yourCommunities );
router.post('/join/:id', joinCommunity);
router.delete('/leave/:id', exitCommunity)
router.delete('/:id', deleteCommunity);

export default router