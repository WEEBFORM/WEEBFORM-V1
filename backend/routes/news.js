import express from "express";
import { allnews, categorizedNews, animeNewsNetwork } from "../controllers/newsController.js"

const router = express.Router()

router.get('/', allnews)
router.get('/ann', animeNewsNetwork)
router.get('/:category', categorizedNews)

export default router