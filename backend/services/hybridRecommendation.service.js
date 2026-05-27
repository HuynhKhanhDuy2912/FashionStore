import NodeCache from "node-cache";
import Product from "../models/Product.js";
import UserBehavior from "../models/UserBehavior.js";
import Wishlist from "../models/Wishlist.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import ProductVariant from "../models/ProductVariant.js";
import { ProductFeatureExtractor, UserProfileBuilder } from "./featureExtraction.service.js";
import { ContentBasedFilteringEngine, CategoryFilter, DiversityHelper } from "./contentBasedFiltering.service.js";
import { RuleBasedEngine, BusinessRulesHelper } from "./ruleBasedRecommendation.service.js";

/**
 * Hybrid Recommendation Engine
 * Kết hợp Content-Based Filtering và Rule-Based Recommendation
 */
class HybridRecommendationEngine {
  constructor() {
    // Cache recommendations for 15 minutes
    this.cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

    this.featureExtractor = new ProductFeatureExtractor();
    this.contentEngine = new ContentBasedFilteringEngine();
    this.userProfileBuilder = new UserProfileBuilder();

    // Weights for hybrid scoring
    this.weights = {
      content: 0.40,      // Content-based similarity
      rule: 0.30,         // Rule-based score
      behavior: 0.20,     // Behavior weight
      popularity: 0.10    // Popularity boost
    };
  }

  /**
   * Main recommendation function
   */
  async getPersonalizedRecommendations(user, options = {}) {
    const {
      limit = 12,
      excludeInteracted = true,
      enableCache = true,
      filters = {}
    } = options;

    // Check cache
    const cacheKey = `rec_${user._id}_${limit}_${JSON.stringify(filters)}`;
    if (enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // 1. Fetch data
      const [behaviors, wishlistItems, products] = await Promise.all([
        UserBehavior.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        Wishlist.find({ userId: user._id }).lean(),
        Product.find({ isActive: true }).lean()
      ]);

      if (products.length === 0) {
        return [];
      }

      // 2. Apply hard filters
      let filteredProducts = RuleBasedEngine.applyHardFilters(products, {
        gender: user.gender,
        ...filters
      });

      // 3. Build feature vectors
      this.featureExtractor.buildTfIdfModel(filteredProducts);
      const productVectors = filteredProducts.map((p, idx) =>
        this.featureExtractor.getProductVector(p, idx)
      );

      // 4. Build user profile
      const userVector = this.userProfileBuilder.buildUserProfile(
        behaviors,
        filteredProducts,
        this.featureExtractor
      );

      // 5. Extract user preferences
      const preferredStyles = this.userProfileBuilder.extractStylePreferences(behaviors);
      const preferredOccasions = this.userProfileBuilder.extractOccasionPreferences(behaviors, filteredProducts);
      const preferredCategories = CategoryFilter.extractPreferredCategories(behaviors, filteredProducts);

      // 6. Get wishlist and interacted product IDs
      const wishlistProductIds = wishlistItems.map(w => w.productId.toString());
      const interactedIds = excludeInteracted
        ? [...new Set(behaviors.map(b => b.productId?.toString()).filter(Boolean))]
        : [];

      // 7. Calculate average purchase price
      const userAveragePurchasePrice = await BusinessRulesHelper.calculateAveragePurchasePrice(
        user._id,
        Order,
        OrderItem
      );

      // 8. Get product variants for stock checking
      const productIds = filteredProducts.map(p => p._id);
      const variantsByProduct = await BusinessRulesHelper.getProductVariants(
        productIds,
        ProductVariant
      );

      // 9. Score all products
      const scoredProducts = filteredProducts.map((product, idx) => {
        const productId = product._id.toString();

        // Skip interacted products if enabled
        if (excludeInteracted && interactedIds.includes(productId)) {
          return null;
        }

        // Content-based score
        const contentScore = userVector
          ? this.contentEngine.calculateSimilarity(userVector, productVectors[idx])
          : 0.5;

        // Rule-based score
        const ruleContext = {
          behaviors,
          preferredOccasions,
          preferredStyles,
          userAveragePurchasePrice,
          wishlistProductIds,
          variants: variantsByProduct[productId] || []
        };
        const { ruleScore, breakdown } = RuleBasedEngine.calculateRuleBasedScore(product, ruleContext);

        // Category score
        const categoryScore = CategoryFilter.calculateCategoryScore(product, preferredCategories);

        // Behavior weight (how much user interacted with similar products)
        const behaviorWeight = this.calculateBehaviorWeight(product, behaviors, filteredProducts);

        // Popularity score
        const popularityScore = RuleBasedEngine.calculatePopularityScore(product);

        // Final hybrid score
        const finalScore =
          contentScore * this.weights.content +
          ruleScore * this.weights.rule +
          behaviorWeight * this.weights.behavior +
          popularityScore * this.weights.popularity +
          categoryScore * 0.05; // Small category boost

        return {
          product,
          finalScore,
          contentScore,
          ruleScore,
          behaviorWeight,
          popularityScore,
          categoryScore,
          ruleBreakdown: breakdown
        };
      }).filter(Boolean); // Remove nulls

      // 10. Sort by final score
      scoredProducts.sort((a, b) => b.finalScore - a.finalScore);

      // 11. Apply diversity
      const diverseProducts = DiversityHelper.ensureDiversity(scoredProducts, 3, 4);

      // 12. Take top N
      const recommendations = diverseProducts.slice(0, limit).map(item => item.product);

      // Cache results
      if (enableCache) {
        this.cache.set(cacheKey, recommendations);
      }

      return recommendations;

    } catch (error) {
      console.error("Recommendation error:", error);

      // Fallback: return popular products
      return Product.find({ isActive: true })
        .sort({ averageRating: -1, totalReviews: -1 })
        .limit(limit)
        .lean();
    }
  }

  /**
   * Calculate behavior weight for a product
   */
  calculateBehaviorWeight(product, behaviors, allProducts) {
    if (!behaviors || behaviors.length === 0) return 0.5;

    const productMap = new Map(allProducts.map(p => [p._id.toString(), p]));
    let totalWeight = 0;
    let matchCount = 0;

    behaviors.forEach(behavior => {
      const behaviorProductId = behavior.productId?.toString();
      if (!behaviorProductId || !productMap.has(behaviorProductId)) return;

      const behaviorProduct = productMap.get(behaviorProductId);

      // Check similarity
      const isSameCategory = behaviorProduct.categoryId?.toString() === product.categoryId?.toString();
      const bStyles = Array.isArray(behaviorProduct.style) ? behaviorProduct.style : [behaviorProduct.style];
      const pStyles = Array.isArray(product.style) ? product.style : [product.style];
      const isSameStyle = bStyles.some(s => pStyles.includes(s));
      const hasOccasionOverlap = (behaviorProduct.occasion || []).some(o =>
        (product.occasion || []).includes(o)
      );

      if (isSameCategory || isSameStyle || hasOccasionOverlap) {
        const actionWeight = this.userProfileBuilder.actionWeights[behavior.actionType] || 1;
        totalWeight += actionWeight;
        matchCount++;
      }
    });

    if (matchCount === 0) return 0.3;

    // Normalize
    return Math.min(totalWeight / (matchCount * 5), 1.0);
  }

  /**
   * Get similar products (item-to-item recommendation)
   */
  async getSimilarProducts(productId, options = {}) {
    const { limit = 12, enableCache = true } = options;

    // Check cache
    const cacheKey = `similar_${productId}_${limit}`;
    if (enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const [targetProduct, allProducts] = await Promise.all([
        Product.findById(productId).lean(),
        Product.find({ isActive: true, _id: { $ne: productId } }).lean()
      ]);

      if (!targetProduct || allProducts.length === 0) {
        return [];
      }

      // Build feature vectors
      this.featureExtractor.buildTfIdfModel([targetProduct, ...allProducts]);
      const targetVector = this.featureExtractor.getProductVector(targetProduct, 0);
      const productVectors = allProducts.map((p, idx) =>
        this.featureExtractor.getProductVector(p, idx + 1)
      );

      // Calculate similarities
      const similarities = allProducts.map((product, idx) => {
        const similarity = this.contentEngine.calculateProductSimilarity(
          targetVector,
          productVectors[idx]
        );

        // Boost if same category or style
        let boost = 1.0;
        if (product.categoryId?.toString() === targetProduct.categoryId?.toString()) {
          boost += 0.2;
        }
        const tStyles = Array.isArray(targetProduct.style) ? targetProduct.style : [targetProduct.style];
        const pStyles = Array.isArray(product.style) ? product.style : [product.style];
        if (tStyles.some(s => pStyles.includes(s))) {
          boost += 0.15;
        }

        return {
          product,
          score: similarity * boost
        };
      });

      // Sort and take top N
      similarities.sort((a, b) => b.score - a.score);
      const recommendations = similarities.slice(0, limit).map(item => item.product);

      // Cache results
      if (enableCache) {
        this.cache.set(cacheKey, recommendations);
      }

      return recommendations;

    } catch (error) {
      console.error("Similar products error:", error);

      // Fallback: same category products
      const targetProduct = await Product.findById(productId).lean();
      if (!targetProduct) return [];

      return Product.find({
        isActive: true,
        categoryId: targetProduct.categoryId,
        _id: { $ne: productId }
      })
        .sort({ averageRating: -1 })
        .limit(limit)
        .lean();
    }
  }

  /**
   * Get trending products (for homepage)
   */
  async getTrendingProducts(options = {}) {
    const { limit = 12, enableCache = true } = options;

    const cacheKey = `trending_${limit}`;
    if (enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Get products with high recent activity
      const recentBehaviors = await UserBehavior.find({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }).lean();

      // Count interactions per product
      const productInteractions = {};
      recentBehaviors.forEach(b => {
        const pid = b.productId?.toString();
        if (pid) {
          const weight = b.actionType === "purchase" ? 5 :
                        b.actionType === "add_to_cart" ? 3 :
                        b.actionType === "favorite" ? 2 : 1;
          productInteractions[pid] = (productInteractions[pid] || 0) + weight;
        }
      });

      // Get top trending product IDs
      const trendingIds = Object.entries(productInteractions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit * 2)
        .map(([pid]) => pid);

      if (trendingIds.length === 0) {
        // Fallback to popular products
        const popular = await Product.find({ isActive: true })
          .sort({ averageRating: -1, totalReviews: -1 })
          .limit(limit)
          .lean();

        if (enableCache) {
          this.cache.set(cacheKey, popular);
        }
        return popular;
      }

      // Fetch products and sort by interaction count
      const products = await Product.find({
        _id: { $in: trendingIds },
        isActive: true
      }).lean();

      const sorted = products
        .map(p => ({
          product: p,
          score: productInteractions[p._id.toString()] || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.product);

      if (enableCache) {
        this.cache.set(cacheKey, sorted);
      }

      return sorted;

    } catch (error) {
      console.error("Trending products error:", error);
      return Product.find({ isActive: true })
        .sort({ averageRating: -1 })
        .limit(limit)
        .lean();
    }
  }

  /**
   * Clear cache
   */
  clearCache(userId = null) {
    if (userId) {
      const keys = this.cache.keys();
      keys.forEach(key => {
        if (key.includes(userId.toString())) {
          this.cache.del(key);
        }
      });
    } else {
      this.cache.flushAll();
    }
  }
}

// Export singleton instance
const recommendationEngine = new HybridRecommendationEngine();

/**
 * Get personalized recommendations for user
 */
export const getPersonalizedRecommendations = async (user, limitParam) => {
  const limit = Math.min(parseInt(limitParam) || 12, 50);
  return recommendationEngine.getPersonalizedRecommendations(user, { limit });
};

/**
 * Get similar products
 */
export const getSimilarProducts = async (productId, limitParam) => {
  const limit = Math.min(parseInt(limitParam) || 12, 50);
  return recommendationEngine.getSimilarProducts(productId, { limit });
};

/**
 * Get trending products
 */
export const getTrendingProducts = async (limitParam) => {
  const limit = Math.min(parseInt(limitParam) || 12, 50);
  return recommendationEngine.getTrendingProducts({ limit });
};

/**
 * Clear recommendation cache
 */
export const clearRecommendationCache = (userId = null) => {
  recommendationEngine.clearCache(userId);
};

export default recommendationEngine;
