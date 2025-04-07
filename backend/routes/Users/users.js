import express from "express";
import {viewUsers, viewProfile, viewUserProfile, editProfile, deleteAccount} from "../../controllers/Users/user.js"

const router = express.Router()

router.get('/', viewUsers)
router.get('/user', viewProfile)
router.get('/:id', viewUserProfile)
router.put('/edit', editProfile)
router.delete('/delete', deleteAccount)

export default router