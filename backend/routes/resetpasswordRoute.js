import express from "express";
import {forgotPassword, resetPassword} from "../controllers/Users/resetpasswordController.js"

const router = express.Router()

router.post('/forgot-password', forgotPassword)
router.post('/reset/:token', resetPassword)

export default router 