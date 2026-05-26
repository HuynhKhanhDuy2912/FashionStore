import express from "express";
import {
  getMyRecommendations,
  getSimilarProductsController,
  getTrendingProductsController,
  clearCacheController
} from "../controllers/recommendation.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Personalized recommendations for logged-in user
router.get("/me", protect, getMyRecommendations);

// Similar products (item-to-item)
router.get("/similar/:productId", getSimilarProductsController);

// Trending products (public)
router.get("/trending", getTrendingProductsController);

// Clear cache (for logged-in user)
router.delete("/cache", protect, clearCacheController);

export default router;
