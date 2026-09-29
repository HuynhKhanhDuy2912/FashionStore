import {
  getPersonalizedRecommendations,
  getSimilarProducts,
  getTrendingProducts,
  getPersonalizedBestsellers,
  getPersonalizedNewArrivals,
  getOutfitRecommendations,
  clearRecommendationCache
} from "../services/hybridRecommendation.service.js";
import { enrichProducts } from "../services/enrichProduct.service.js";

export const getMyRecommendations = async (req, res) => {
  try {
    const recommendations = await getPersonalizedRecommendations(
      req.user,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Personalized recommendations fetched successfully",
      data: await enrichProducts(recommendations)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSimilarProductsController = async (req, res) => {
  try {
    const { productId } = req.params;
    const similarProducts = await getSimilarProducts(productId, req.query.limit);

    return res.status(200).json({
      success: true,
      message: "Similar products fetched successfully",
      data: await enrichProducts(similarProducts)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getTrendingProductsController = async (req, res) => {
  try {
    const trendingProducts = await getTrendingProducts(req.query.limit);

    return res.status(200).json({
      success: true,
      message: "Trending products fetched successfully",
      data: await enrichProducts(trendingProducts)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const clearCacheController = async (req, res) => {
  try {
    const userId = req.user?._id;
    clearRecommendationCache(userId);

    return res.status(200).json({
      success: true,
      message: "Recommendation cache cleared successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getPersonalizedBestsellersController = async (req, res) => {
  try {
    const bestsellers = await getPersonalizedBestsellers(
      req.user,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Personalized bestsellers fetched successfully",
      data: await enrichProducts(bestsellers)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getPersonalizedNewArrivalsController = async (req, res) => {
  try {
    const newArrivals = await getPersonalizedNewArrivals(
      req.user,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Personalized new arrivals fetched successfully",
      data: await enrichProducts(newArrivals)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Outfit recommendations — complementary products for "Complete the Look"
 * Works for both guests (basic style matching) and logged-in users (+ personalization)
 */
export const getOutfitRecommendationsController = async (req, res) => {
  try {
    const { productId } = req.params;
    const outfit = await getOutfitRecommendations(
      productId,
      req.user || null,
      req.query.limit
    );

    // Enrich outfit items with variants and gallery images
    if (outfit.outfitItems && outfit.outfitItems.length > 0) {
      outfit.outfitItems = await enrichProducts(outfit.outfitItems);
    }

    return res.status(200).json({
      success: true,
      message: "Outfit recommendations fetched successfully",
      data: outfit
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
