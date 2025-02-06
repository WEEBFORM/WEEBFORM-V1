import express from "express";
import {followUser, getFollowers, unfollowUser, getFollowing} from "../controllers/feedInteractions/followers.js"

const router = express.Router()

router.post('/:followed', followUser)
router.get('/', getFollowers)
router.get('/:userId', getFollowing)
router.delete('/:followed', unfollowUser)


export default router