import express from "express";
import sizeGuideController from "../controllers/sizeGuide.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public route
router.get("/by-category/:categoryId", sizeGuideController.getByCategoryId);

// Admin routes
router.get("/", protect, authorize("admin"), sizeGuideController.list);
router.get("/:id", protect, authorize("admin"), sizeGuideController.getById);
router.post("/", protect, authorize("admin"), sizeGuideController.create);
router.put("/:id", protect, authorize("admin"), sizeGuideController.update);
router.delete("/:id", protect, authorize("admin"), sizeGuideController.remove);

export default router;
