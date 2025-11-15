import express from "express";
import {forgotPassword, resetPassword, editPassword} from "../../controllers/Users/resetpasswordController.js"

const router = express.Router()

router.post('/forgot-password', forgotPassword);
router.post('/reset/:token', resetPassword);
router.put('/edit-password', editPassword);

export default router 