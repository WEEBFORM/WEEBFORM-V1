import express from "express";
import {
  getNotifications,
  markAsRead,
  registerDevice
} from "../controllers/Notifications/notificationsController.js";

const router = express.Router();

router.get("/", getNotifications);
router.put("/read", markAsRead);
router.post("/register-device", registerDevice);

export default router;