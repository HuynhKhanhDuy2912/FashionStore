import express from "express";
import notificationController from "../controllers/notification.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, authorize("admin"), notificationController.getMyNotifications);
router.get("/unread-count", protect, authorize("admin"), notificationController.getMyUnreadCount);
router.patch("/:id/read", protect, authorize("admin"), notificationController.markNotificationAsRead);
router.patch("/read-all", protect, authorize("admin"), notificationController.markAllNotificationsAsRead);

export default router;
