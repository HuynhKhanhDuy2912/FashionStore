import express from "express";
import {
  getMyRecommendations,
  getSimilarProductsController,
  getTrendingProductsController,
  getPersonalizedBestsellersController,
  getPersonalizedNewArrivalsController,
  clearCacheController
} from "../controllers/recommendation.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Personalized recommendations for logged-in user
router.get("/me", protect, getMyRecommendations);

// Personalized bestsellers (re-ranked by user preferences)
router.get("/personalized-bestsellers", protect, getPersonalizedBestsellersController);

// Personalized new arrivals (re-ranked by user preferences)
router.get("/personalized-new-arrivals", protect, getPersonalizedNewArrivalsController);

// Similar products (item-to-item)
router.get("/similar/:productId", getSimilarProductsController);

// Trending products (public)
router.get("/trending", getTrendingProductsController);

// Clear cache (for logged-in user)
router.delete("/cache", protect, clearCacheController);

export default router;
