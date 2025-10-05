import express from 'express';
import {
    addComment,
    getComments,
    deleteComment,
    addReply,
    getReplies,
    deleteReply,
    getUserComments
} from '../../controllers/feedInteractions/comments.js';

const router = express.Router();

// COMMENTS ON A POST
// POST   /api/comments/posts/:postId -> Add a comment to a post
// GET    /api/comments/posts/:postId -> Get all comments for a post
router.route('/posts/:postId')
    .post(addComment)
    .get(getComments);

// SPECIFIC COMMENT ACTIONS
// DELETE /api/comments/:commentId -> Delete a comment
router.route('/:commentId')
    .delete(deleteComment);

// --- REPLIES ---
// POST   /api/comments/replies -> Add a reply (to a comment or another reply)
// GET    /api/comments/:commentId/replies -> Get all replies for a comment (flat list)
// DELETE /api/comments/replies/:replyId -> Delete a reply
router.route('/replies')
    .post(addReply);

router.route('/:commentId/replies')
    .get(getReplies);

router.route('/replies/:replyId')
    .delete(deleteReply);

// --- USER ACTIVITY ---
// GET    /api/comments/user/:userId -> Get all comments made by a specific user
router.route('/user/:userId')
    .get(getUserComments);

export default router;