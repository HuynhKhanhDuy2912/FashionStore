import express from "express";
import contactController from "../controllers/contact.controller.js";
import { authorize, protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", protect, contactController.createContactRequest);
router.get("/", protect, authorize("admin"), contactController.getContactRequests);
router.get("/unread-count", protect, authorize("admin"), contactController.getUnreadContactCount);
router.get("/:id", protect, authorize("admin"), contactController.getContactRequestById);
router.patch("/:id/read", protect, authorize("admin"), contactController.markContactRequestAsRead);
router.post("/:id/reply", protect, authorize("admin"), contactController.replyContactRequest);

export default router;
