import express from "express";
import {
  getNotifications,
  markAsRead,
} from "../../controllers/Users/notificationsController.js";

const router = express.Router();

router.get("/", getNotifications);
router.put("/read", markAsRead);

export default router;