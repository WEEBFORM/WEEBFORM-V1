import express from "express";
import { authenticateUser } from "../../middlewares/verify.mjs";
import {
  muteUser,
  banUser,
  applySlowMode,
  exileUser,
} from "../../controllers/community/services/moderationService.js";
import {
  getUserActivity,
  getUserLevel,
} from "../../controllers/community/services/gamificationService.js";

const router = express.Router();

router.post("/moderation/mute", authenticateUser, muteUser);
router.post("/moderation/ban", authenticateUser, banUser);
router.post("/moderation/slow-mode", authenticateUser, applySlowMode);
router.post("/moderation/exile", authenticateUser, exileUser);
router.get("/gamification/activity", authenticateUser, getUserActivity);
router.get("/gamification/level", authenticateUser, getUserLevel);

export default router;