import express from "express";
import {like, getLikes, unlike} from "../controllers/feedInteractions/likes.js"

const router = express.Router()

router.post('/like/:postId', like)
router.get('/likes/:postId', getLikes)
router.delete('/unlike/:postId', unlike)


export default router