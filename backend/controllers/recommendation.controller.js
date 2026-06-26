import {
  getPersonalizedRecommendations,
  getSimilarProducts,
  getTrendingProducts,
  getPersonalizedBestsellers,
  getPersonalizedNewArrivals,
  clearRecommendationCache
} from "../services/hybridRecommendation.service.js";
import ProductVariant from "../models/ProductVariant.js";
import Collection from "../models/Collection.js";
import { attachGalleryImagesToProducts } from "../services/productImage.service.js";

/**
 * Enrich a list of products with availableVariants and collectionName
 * so ProductCard can display color swatches, sizes, and quick-add to cart.
 */
export async function enrichProducts(products) {
  if (!products || products.length === 0) return products;

  const productIds = products.map((p) => p._id);

  // 1. Fetch all active variants for these products in one query
  const variants = await ProductVariant.find({
    productId: { $in: productIds },
    isActive: true
  }).lean();

  // 2. Fetch active collections that contain any of these products
  const collections = await Collection.find({
    isActive: true,
    products: { $in: productIds }
  })
    .select("name products")
    .lean();

  // Build a map: productId -> collectionName (first match wins)
  const collectionNameMap = new Map();
  collections.forEach((col) => {
    col.products.forEach((pid) => {
      const key = pid.toString();
      if (!collectionNameMap.has(key)) {
        collectionNameMap.set(key, col.name);
      }
    });
  });

  // Build a map: productId -> variants[]
  const variantsByProduct = new Map();
  variants.forEach((v) => {
    const key = v.productId.toString();
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(v);
  });

  const productsWithGalleryImages = await attachGalleryImagesToProducts(products);

  // Attach to each product
  return productsWithGalleryImages.map((product) => {
    const key = product._id.toString();
    return {
      ...product,
      availableVariants: variantsByProduct.get(key) || [],
      collectionName: collectionNameMap.get(key) || product.collectionName || null
    };
  });
}

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
