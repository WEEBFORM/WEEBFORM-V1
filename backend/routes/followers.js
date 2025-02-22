import express from "express";
import { followUser, getFollowers, unfollowUser, getFollowing } from "../controllers/feedInteractions/followers.js"

const router = express.Router()

router.post('/follow/:followed', followUser) // Corrected route for followUser
router.get('/followers/:userId', getFollowers) // Correct Route
router.get('/following/:userId', getFollowing) // Correct Route
router.delete('/unfollow/:followed', unfollowUser) // Corrected route for unfollowUser

export default router  