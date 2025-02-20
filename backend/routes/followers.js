import express from "express";
import {followUser, getFollowers, unfollowUser, getFollowing} from "../controllers/feedInteractions/followers.js"

const router = express.Router()

router.post('/:followed', followUser)
router.get('/followers/:userId', getFollowers)
router.get('/following/:userId', getFollowing)
router.delete('/:followed', unfollowUser)


export default router