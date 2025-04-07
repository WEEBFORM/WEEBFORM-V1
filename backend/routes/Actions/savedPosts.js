import express from 'express';
import {
    savePost,
    unSavePost,
    getSavedPosts
} from '../../controllers/Actions/savePost.js';

const router = express.Router();

router.post('/save', savePost);
router.delete('/unsave/:postId', unSavePost);
router.get('/saved-posts', getSavedPosts);

export default router;