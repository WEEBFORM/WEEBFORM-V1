import express from "express";
import {addComment, getComment, deleteComment} from "../controllers/feedInteractions/comments.js"

const router = express.Router()

router.post('/:postId', addComment)
router.get('/:postId', getComment)
router.delete('/:commentId', deleteComment)


export default router