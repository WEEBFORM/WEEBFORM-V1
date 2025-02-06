import express from "express";
import {addStory, viewStory, deleteStory} from "../controllers/stories.js"

const router = express.Router()

router.post('/add-story', addStory)
router.get('/', viewStory)
router.delete('/:id', deleteStory)
 
export default router