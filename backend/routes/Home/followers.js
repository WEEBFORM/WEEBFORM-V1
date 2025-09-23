import express from "express";
import { followUser, getFollowers, unfollowUser, getFollowing, checkFollowStatus, getRecommendedUsers, getSocialDirectory} from "../../controllers/feedInteractions/friendships.js"

const router = express.Router()

router.get('/social-directory', getSocialDirectory);

router.post('/follow/:followed', followUser);
router.get('/followers/:userId', getFollowers);
router.get('/following/:userId', getFollowing);
router.delete('/unfollow/:followed', unfollowUser);
router.get('/following/status/:profileId', checkFollowStatus);
router.get('/recommended/:userId', getRecommendedUsers);

export default router 