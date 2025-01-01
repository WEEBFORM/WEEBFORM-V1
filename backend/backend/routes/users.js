import express from "express";
import {viewUsers, viewProfile, editProfile, deleteAccount} from "../controllers/Users/user.js"

const router = express.Router()

router.get('/', viewUsers)
router.get('/:id', viewProfile)
router.put('/:userId', editProfile)
router.delete('/:id', deleteAccount)

export default router