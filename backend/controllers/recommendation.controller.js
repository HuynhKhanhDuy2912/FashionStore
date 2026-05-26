import {
  getPersonalizedRecommendations,
  getSimilarProducts,
  getTrendingProducts,
  clearRecommendationCache
} from "../services/hybridRecommendation.service.js";

export const getMyRecommendations = async (req, res) => {
  try {
    const recommendations = await getPersonalizedRecommendations(
      req.user,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Personalized recommendations fetched successfully",
      data: recommendations
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
      data: similarProducts
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
      data: trendingProducts
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
