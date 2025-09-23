import express from "express";
import {newPost, postCategory, allPosts, followingPosts, userPosts, getPostById, bookmarkPost, getBookmarkedPosts, deletePost} from "../../controllers/feedInteractions/posts.js"

const router = express.Router()

router.get('/bookmarks/view', getBookmarkedPosts);

router.post('/', newPost)
router.get('/user/:id', userPosts)
router.get('/following/:id', followingPosts)
router.get('/:category', postCategory)
router.get('/', allPosts) 
router.post('/:id/bookmark', bookmarkPost);

router.get("/:id", getPostById);

router.delete('/:id', deletePost) 


export default router