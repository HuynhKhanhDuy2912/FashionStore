import express from "express";
import reviewController from "../controllers/review.controller.js";
import Review from "../models/Review.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import {
  attachOwner,
  checkOwnership,
  scopeToOwner
} from "../middlewares/ownership.middleware.js";

const router = express.Router();

router.get("/eligibility/:productId", protect, reviewController.checkReviewEligibility);

// Admin routes
router.get("/admin/list", protect, authorize("admin"), reviewController.adminList);
router.patch("/admin/:id/hide", protect, authorize("admin"), reviewController.hideReview);
router.patch("/admin/:id/show", protect, authorize("admin"), reviewController.showReview);

// Public routes
router.get("/", reviewController.list);
router.get("/:id", protect, checkOwnership(Review, "userId"), reviewController.getById);
router.post("/", protect, attachOwner("userId"), reviewController.create);
router.put("/:id", protect, checkOwnership(Review, "userId"), attachOwner("userId"), reviewController.update);
router.delete("/:id", protect, checkOwnership(Review, "userId"), reviewController.remove);

export default router;
