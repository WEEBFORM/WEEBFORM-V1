import express from "express";
import {createCommunity, communities, exitCommunity, deleteCommunity} from "../../controllers/communityInteractions/community.js";

const router = express.Router();

router.post('/create', createCommunity);
router.get('/', communities );
//router.get('/', yourCommunities );
router.post('/join/:id', joinCommunity);
router.delete('/joined/:id', exitCommunity)
router.delete('/:id', deleteCommunity);

export default router