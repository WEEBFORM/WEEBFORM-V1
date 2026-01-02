import express from "express";
import {
  getNotifications,
  markAsRead,
  registerDevice,
  markSingleAsRead,
  unregisterDevice
} from "../controllers/Notifications/notificationsController.js";

const router = express.Router();

router.get("/", getNotifications);
router.put("/read", markAsRead);
router.put("/read/:id", markSingleAsRead);
router.post("/register-device", registerDevice);
router.post("/unregister-device", unregisterDevice);

export default router;