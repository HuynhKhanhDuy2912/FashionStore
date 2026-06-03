import express from "express";
import couponController from "../controllers/coupon.controller.js";
import { authorize, protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public
router.get("/public", couponController.listPublicCoupons);

// User (auth required)
router.get("/available", protect, couponController.listAvailableCoupons);
router.post("/apply", protect, couponController.applyCouponPreview);

// Admin
router.get("/admin/all", protect, authorize("admin"), couponController.adminListCoupons);
router.get("/admin/:id", protect, authorize("admin"), couponController.adminGetCoupon);
router.post("/admin", protect, authorize("admin"), couponController.adminCreateCoupon);
router.put("/admin/:id", protect, authorize("admin"), couponController.adminUpdateCoupon);
router.delete("/admin/:id", protect, authorize("admin"), couponController.adminDeleteCoupon);
router.patch("/admin/:id/toggle", protect, authorize("admin"), couponController.adminToggleCoupon);

export default router;
