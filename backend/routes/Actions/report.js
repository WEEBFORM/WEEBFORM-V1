import express from 'express';
import {
    reportPost
} from '../../controllers/Actions/report.js';

const router = express.Router();

router.post('/report', reportPost);

export default router;