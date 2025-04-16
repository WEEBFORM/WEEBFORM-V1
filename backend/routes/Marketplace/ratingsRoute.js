import express from 'express';
import {
    rateStore,
    getAverageStoreRating,
    recordStoreVisit,
    getStoreVisitStats
} from '../../controllers/Marketplace/ratings.js';

const router = express.Router();

//RATE STORE
router.post('/rate-store/:storeId', rateStore);
router.get('/average-store-rating/:storeId', getAverageStoreRating);
//STORE VISITS
router.post('/record-store-visit/:storeId', recordStoreVisit);
router.get('/store-visit-stats/:storeId', getStoreVisitStats);

export default router;