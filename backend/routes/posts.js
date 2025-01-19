import express from "express";
import {newPost, postCategory, allPosts, followingPosts, userPosts, deletePost} from "../controllers/feedInteractions/posts.js"

const router = express.Router()

router.post('/', newPost)
router.get('/user/:id', userPosts)
router.get('/following/:id', followingPosts)
router.get('/:category', postCategory)
router.get('/', allPosts)

router.delete('/:id', deletePost) 


export default router