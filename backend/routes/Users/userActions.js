import express from 'express';
// import {
//     bookmarkPost,
//     unBookmarkPost,
//     getBookmarkedPosts
// } from '../../controllers/Actions/bookmarkPost.js';
const router = express.Router();

import { blockUser,
         unblockUser,
         getBlockedUsers
} from "../../controllers/Actions/blockedController.js";

import {
    createReport,
    getReports,
    updateReportStatus
} from '../../controllers/Actions/report.js';

//REPORT
router.post('/report', createReport);
router.get('/reports', getReports);
router.put('/:reportId', updateReportStatus);


//BLOCK USERS
router.post('/block/:blockedUser', blockUser);
router.delete('/unblock/:blockedUser', unblockUser);
router.get('/blockedUsers', getBlockedUsers)

//BOOKMARK POSTS
// router.get('/bookmarks', getBookmarkedPosts);
// router.post('/bookmarks/:postId', bookmarkPost);
// router.delete('/bookmarks/:postId', unBookmarkPost);

export default router;