import express from "express";
import {
    allnews,
    categorizedNews,
    animeNewsNetwork,
    fetchConsolidatedAnimeData
} from "../controllers/news/newsController.js"
import { getAnimeRecommendations } from "../controllers/news/recommendationController.js";

const router = express.Router() 

//NEWS
router.get('/', allnews)
router.get('/ann', animeNewsNetwork)
router.get('/consolidated-section', fetchConsolidatedAnimeData);
router.get('/:category', categorizedNews)

//RECOMMENDATIONS
router.get('/user/recommended', getAnimeRecommendations) 

export default router 