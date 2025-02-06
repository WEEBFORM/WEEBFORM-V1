import express from "express";
import {replyComment, viewReply, deleteReply} from "../controllers/feedInteractions/commentReplies.js"

const router = express.Router()

router.post('/:commentId', replyComment)
router.get('/:commentId', viewReply)
router.delete('/:commentId', deleteReply)


export default router