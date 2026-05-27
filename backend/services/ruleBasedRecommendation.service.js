/**
 * Rule-Based Recommendation Engine
 * Áp dụng các business rules và heuristics
 */
export class RuleBasedEngine {
  constructor() {
    this.rules = [];
  }

  /**
   * Recency Rule: Boost sản phẩm user xem gần đây
   */
  static calculateRecencyScore(product, behaviors) {
    if (!behaviors || behaviors.length === 0) return 0.5;

    const productId = product._id.toString();
    const recentBehaviors = behaviors.filter(b =>
      b.productId?.toString() === productId
    );

    if (recentBehaviors.length === 0) return 0.5;

    // Lấy behavior gần nhất
    const mostRecent = recentBehaviors[0]; // behaviors đã sort by createdAt desc
    const daysSince = (Date.now() - new Date(mostRecent.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay: score cao nếu xem trong 7 ngày gần đây
    if (daysSince <= 7) {
      return 1.0;
    } else if (daysSince <= 30) {
      return 0.8 - (daysSince - 7) * 0.02; // Giảm dần từ 0.8 -> 0.3
    } else {
      return 0.3;
    }
  }

  /**
   * Popularity Rule: Boost sản phẩm phổ biến
   */
  static calculatePopularityScore(product) {
    const rating = product.averageRating || 0;
    const reviews = product.totalReviews || 0;

    // Weighted rating (Bayesian average)
    const minReviews = 5;
    const globalAverage = 3.5;

    const weightedRating = (reviews * rating + minReviews * globalAverage) / (reviews + minReviews);

    // Normalize to 0-1
    return weightedRating / 5;
  }

  /**
   * Seasonal Rule: Boost sản phẩm phù hợp mùa hiện tại
   */
  static calculateSeasonalScore(product) {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    let currentSeason;

    if (currentMonth >= 3 && currentMonth <= 5) {
      currentSeason = "spring";
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      currentSeason = "summer";
    } else if (currentMonth >= 9 && currentMonth <= 11) {
      currentSeason = "autumn";
    } else {
      currentSeason = "winter";
    }

    const productSeasons = product.season || ["all_season"];

    if (productSeasons.includes("all_season")) {
      return 0.8;
    } else if (productSeasons.includes(currentSeason)) {
      return 1.0;
    } else {
      return 0.4;
    }
  }

  /**
   * Discount Rule: Boost sản phẩm có discount cao
   */
  static calculateDiscountScore(product) {
    const discount = product.discount || 0;

    if (discount >= 50) {
      return 1.0;
    } else if (discount >= 30) {
      return 0.8;
    } else if (discount >= 10) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * Occasion Matching Rule: Boost sản phẩm phù hợp occasion user quan tâm
   */
  static calculateOccasionScore(product, preferredOccasions) {
    if (!preferredOccasions || preferredOccasions.length === 0) {
      return 0.5;
    }

    const productOccasions = product.occasion || [];
    const overlap = productOccasions.filter(o => preferredOccasions.includes(o)).length;

    if (overlap === 0) {
      return 0.3;
    } else if (overlap === 1) {
      return 0.7;
    } else {
      return 1.0;
    }
  }

  /**
   * Style Matching Rule: Boost sản phẩm phù hợp style user thích
   */
  static calculateStyleScore(product, preferredStyles) {
    if (!preferredStyles || preferredStyles.length === 0) {
      return 0.5;
    }

    const productStyles = Array.isArray(product.style) ? product.style : [product.style || "casual"];

    // Direct match: any of the product's styles is in user's preferred styles
    if (productStyles.some(s => preferredStyles.includes(s))) {
      return 1.0;
    } else {
      // Partial match cho similar styles
      const similarStyles = {
        minimal: ["casual", "smart_casual"],
        streetwear: ["casual", "sporty"],
        casual: ["minimal", "smart_casual"],
        elegant: ["smart_casual", "formal"],
        sporty: ["casual", "streetwear"],
        vintage: ["casual", "elegant"],
        smart_casual: ["casual", "elegant", "minimal"]
      };

      const hasSimilar = productStyles.some(ps => {
        const similar = similarStyles[ps] || [];
        return similar.some(s => preferredStyles.includes(s));
      });
      return hasSimilar ? 0.6 : 0.3;
    }
  }

  /**
   * Price Range Rule: Boost sản phẩm trong price range user thường mua
   */
  static calculatePriceRangeScore(product, userAveragePurchasePrice) {
    if (!userAveragePurchasePrice || userAveragePurchasePrice === 0) {
      return 0.5;
    }

    const productPrice = product.price * (1 - (product.discount || 0) / 100);
    const ratio = productPrice / userAveragePurchasePrice;

    // Prefer products trong khoảng 0.5x - 1.5x average price
    if (ratio >= 0.5 && ratio <= 1.5) {
      return 1.0;
    } else if (ratio >= 0.3 && ratio <= 2.0) {
      return 0.7;
    } else {
      return 0.4;
    }
  }

  /**
   * Stock Availability Rule: Penalize out-of-stock products
   */
  static calculateStockScore(product, variants) {
    if (!variants || variants.length === 0) {
      return 0.5; // Unknown stock
    }

    const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    if (totalStock === 0) {
      return 0.1; // Out of stock
    } else if (totalStock < 5) {
      return 0.6; // Low stock
    } else {
      return 1.0; // In stock
    }
  }

  /**
   * Freshness Rule: Boost sản phẩm mới
   */
  static calculateFreshnessScore(product) {
    const createdAt = new Date(product.createdAt);
    const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreated <= 7) {
      return 1.0; // New arrival
    } else if (daysSinceCreated <= 30) {
      return 0.8;
    } else if (daysSinceCreated <= 90) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * Wishlist Rule: Boost sản phẩm trong wishlist
   */
  static calculateWishlistScore(product, wishlistProductIds) {
    if (!wishlistProductIds || wishlistProductIds.length === 0) {
      return 0.5;
    }

    const productId = product._id.toString();
    return wishlistProductIds.includes(productId) ? 1.0 : 0.5;
  }

  /**
   * Calculate combined rule-based score
   */
  static calculateRuleBasedScore(product, context) {
    const {
      behaviors = [],
      preferredOccasions = [],
      preferredStyles = [],
      userAveragePurchasePrice = 0,
      wishlistProductIds = [],
      variants = []
    } = context;

    // Calculate individual rule scores
    const recencyScore = this.calculateRecencyScore(product, behaviors);
    const popularityScore = this.calculatePopularityScore(product);
    const seasonalScore = this.calculateSeasonalScore(product);
    const discountScore = this.calculateDiscountScore(product);
    const occasionScore = this.calculateOccasionScore(product, preferredOccasions);
    const styleScore = this.calculateStyleScore(product, preferredStyles);
    const priceRangeScore = this.calculatePriceRangeScore(product, userAveragePurchasePrice);
    const stockScore = this.calculateStockScore(product, variants);
    const freshnessScore = this.calculateFreshnessScore(product);
    const wishlistScore = this.calculateWishlistScore(product, wishlistProductIds);

    // Weighted combination
    const weights = {
      recency: 0.15,
      popularity: 0.15,
      seasonal: 0.10,
      discount: 0.08,
      occasion: 0.12,
      style: 0.15,
      priceRange: 0.08,
      stock: 0.07,
      freshness: 0.05,
      wishlist: 0.05
    };

    const ruleScore =
      recencyScore * weights.recency +
      popularityScore * weights.popularity +
      seasonalScore * weights.seasonal +
      discountScore * weights.discount +
      occasionScore * weights.occasion +
      styleScore * weights.style +
      priceRangeScore * weights.priceRange +
      stockScore * weights.stock +
      freshnessScore * weights.freshness +
      wishlistScore * weights.wishlist;

    return {
      ruleScore,
      breakdown: {
        recency: recencyScore,
        popularity: popularityScore,
        seasonal: seasonalScore,
        discount: discountScore,
        occasion: occasionScore,
        style: styleScore,
        priceRange: priceRangeScore,
        stock: stockScore,
        freshness: freshnessScore,
        wishlist: wishlistScore
      }
    };
  }

  /**
   * Apply hard filters (must-have conditions)
   */
  static applyHardFilters(products, filters) {
    let filtered = [...products];

    // Filter by gender
    if (filters.gender) {
      filtered = filtered.filter(p =>
        p.gender === filters.gender || p.gender === ""
      );
    }

    // Filter by price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      filtered = filtered.filter(p => {
        const price = p.price * (1 - (p.discount || 0) / 100);
        const minOk = filters.minPrice === undefined || price >= filters.minPrice;
        const maxOk = filters.maxPrice === undefined || price <= filters.maxPrice;
        return minOk && maxOk;
      });
    }

    // Filter by categories
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      filtered = filtered.filter(p =>
        filters.categoryIds.includes(p.categoryId?.toString())
      );
    }

    // Filter by active status
    filtered = filtered.filter(p => p.isActive !== false);

    return filtered;
  }
}

/**
 * Business Rules Helper
 */
export class BusinessRulesHelper {
  /**
   * Calculate user's average purchase price từ order history
   */
  static async calculateAveragePurchasePrice(userId, OrderModel, OrderItemModel) {
    try {
      const orders = await OrderModel.find({
        userId,
        status: "completed"
      }).lean();

      if (orders.length === 0) return 0;

      const orderIds = orders.map(o => o._id);
      const orderItems = await OrderItemModel.find({
        orderId: { $in: orderIds }
      }).lean();

      if (orderItems.length === 0) return 0;

      const totalPrice = orderItems.reduce((sum, item) => sum + item.price, 0);
      return totalPrice / orderItems.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get product variants for stock checking
   */
  static async getProductVariants(productIds, ProductVariantModel) {
    try {
      const variants = await ProductVariantModel.find({
        productId: { $in: productIds }
      }).lean();

      // Group by productId
      const variantsByProduct = {};
      variants.forEach(v => {
        const pid = v.productId.toString();
        if (!variantsByProduct[pid]) {
          variantsByProduct[pid] = [];
        }
        variantsByProduct[pid].push(v);
      });

      return variantsByProduct;
    } catch (error) {
      return {};
    }
  }
}
