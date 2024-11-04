import express from "express";
import {initiateRegistration, register, login, logout} from "../controllers/Users/auth.js"

const router = express.Router()

router.post('/create', initiateRegistration)
router.post('/register', register)
router.post('/login', login)
router.post('/logout', logout)
 


export default router