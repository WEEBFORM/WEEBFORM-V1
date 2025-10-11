import express from "express";
import {newPost, postCategory, allPosts, followingPosts, userPosts, getPostById, bookmarkPost, getBookmarkedPosts, sharePost, getReposts, deletePost, toggleRepost} from "../../controllers/feedInteractions/posts.js"
import { authenticateUser } from "../../middlewares/verify.mjs";

const router = express.Router()

router.get('/bookmarks/view', getBookmarkedPosts);

router.post('/', newPost)
router.post('/:id/bookmark', authenticateUser, bookmarkPost);
router.post('/:id/share', sharePost)

router.get('/user/:id', userPosts)
router.get('/following/:id', followingPosts)
router.get('/:category', postCategory)
router.get('/', allPosts) 

router.post('/:id/repost', toggleRepost);

router.get('/:id/reposts', getReposts);

router.get("/:id", getPostById);
router.delete('/:id', deletePost) 


export default router