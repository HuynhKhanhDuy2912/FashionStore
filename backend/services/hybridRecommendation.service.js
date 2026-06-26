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
import { ItemBasedCollaborativeEngine } from "./collaborativeFiltering.service.js";

/**
 * Ngưỡng điểm sàn (0–100) để hiển thị badge "Match %".
 *
 * Gợi ý có matchScore < ngưỡng này được coi là "độ tự tin thấp": backend trả
 * matchScore = null + isHighMatch = false để Frontend ẨN badge thay vì khoe một
 * con số gây hiểu lầm. Đây là tham số cần CALIBRATE theo phân phối điểm thực tế
 * (xem phân phối finalScore trong log/analytics): đặt quá cao sẽ ẩn gần hết badge,
 * quá thấp sẽ lại để lọt các gợi ý yếu.
 */
const MIN_MATCH_THRESHOLD = 60;

/**
 * Hybrid Recommendation Engine v2.0
 *
 * Kết hợp 5 engines:
 * 1. Content-Based Filtering (30%) — Cosine similarity giữa user profile và product vectors
 * 2. Collaborative Filtering (20%) — Item co-occurrence từ hành vi TẤT CẢ users
 * 3. Rule-Based Recommendation (20%) — 10 business rules
 * 4. Behavior-Based Scoring (15%) — Category/style/occasion overlap
 * 5. Popularity Scoring (10%) — Bayesian average rating
 * + Category Boost (5%) + Diversity (MMR)
 */
class HybridRecommendationEngine {
  constructor() {
    // Cache recommendations for 5 minutes
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

    this.featureExtractor = new ProductFeatureExtractor();
    this.contentEngine = new ContentBasedFilteringEngine();
    this.userProfileBuilder = new UserProfileBuilder();
    this.collaborativeEngine = new ItemBasedCollaborativeEngine();

    // Weights for hybrid scoring v2.0
    this.weights = {
      content: 0.30,        // Content-based similarity (giảm từ 0.40)
      collaborative: 0.20,  // Collaborative filtering (MỚI)
      rule: 0.20,           // Rule-based score (giảm từ 0.30)
      behavior: 0.15,       // Behavior weight (giảm từ 0.20)
      popularity: 0.10,     // Popularity boost (giữ nguyên)
      category: 0.05        // Category boost (chính thức hóa)
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

      // === COLD START: User mới (0 behaviors) → gợi ý demographic-aware ===
      if (!behaviors || behaviors.length === 0) {
        return this.getColdStartRecommendations(user, products, limit, filters);
      }

      // 2. Apply hard filters
      let filteredProducts = RuleBasedEngine.applyHardFilters(products, {
        gender: user.gender,
        ...filters
      });

      // 3. Build TF-IDF trên TOÀN BỘ products (index ổn định cho mọi user)
      this.featureExtractor.buildTfIdfModel(products);
      // Tạo vectors chỉ cho filtered products, dùng index ổn định từ full list
      const productVectors = filteredProducts.map((p) =>
        this.featureExtractor.getProductVector(p)
      );

      // 4. Build user profile (temporal: ngắn hạn vs dài hạn)
      const userVector = this.userProfileBuilder.buildTemporalProfile(
        behaviors,
        filteredProducts,
        this.featureExtractor
      );

      // 5. Extract user preferences
      let preferredStyles = this.userProfileBuilder.extractStylePreferences(behaviors, filteredProducts);
      let preferredOccasions = this.userProfileBuilder.extractOccasionPreferences(behaviors, filteredProducts);
      const preferredCategories = CategoryFilter.extractPreferredCategories(behaviors, filteredProducts);

      // 5.5 Extract search intents và merge vào preferences
      const searchIntents = this.userProfileBuilder.extractSearchIntents(behaviors);
      if (searchIntents.styles.length > 0) {
        preferredStyles = [...new Set([...preferredStyles, ...searchIntents.styles])];
      }
      if (searchIntents.occasions.length > 0) {
        preferredOccasions = [...new Set([...preferredOccasions, ...searchIntents.occasions])];
      }

      // 6. Get wishlist and interacted product IDs
      const wishlistProductIds = wishlistItems.map(w => w.productId.toString());
      // allInteractedIds: luôn tính để dùng cho collaborative scoring
      const allInteractedIds = [...new Set(behaviors.map(b => b.productId?.toString()).filter(Boolean))];
      // excludeIds: chỉ dùng để loại sản phẩm đã tương tác khỏi kết quả
      const excludeIds = excludeInteracted ? allInteractedIds : [];

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

      // 8.5 Build co-occurrence matrix cho Collaborative Filtering (cached 30 phút)
      const coOccurrenceMatrix = await this.collaborativeEngine.getOrBuildMatrix(UserBehavior);

      // 9. Score all products
      const scoredProducts = filteredProducts.map((product, idx) => {
        const productId = product._id.toString();

        // Skip interacted products if enabled
        if (excludeInteracted && excludeIds.includes(productId)) {
          return null;
        }

        // Content-based score
        const contentScore = userVector
          ? this.contentEngine.calculateSimilarity(userVector, productVectors[idx])
          : 0.5;

        // Collaborative filtering score — luôn dùng allInteractedIds
        const collaborativeScore = this.collaborativeEngine.getCollaborativeScore(
          productId,
          allInteractedIds,
          coOccurrenceMatrix
        );

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

        // Final hybrid score v2.0
        const finalScore =
          contentScore * this.weights.content +
          collaborativeScore * this.weights.collaborative +
          ruleScore * this.weights.rule +
          behaviorWeight * this.weights.behavior +
          popularityScore * this.weights.popularity +
          categoryScore * this.weights.category;

        return {
          product,
          finalScore,
          contentScore,
          collaborativeScore,
          ruleScore,
          behaviorWeight,
          popularityScore,
          categoryScore,
          ruleBreakdown: breakdown
        };
      }).filter(Boolean); // Remove nulls

      // 10. Sort by final score
      scoredProducts.sort((a, b) => b.finalScore - a.finalScore);

      // 11. Apply diversity (MMR: cân bằng relevance vs diversity tốt hơn hard constraints)
      const diverseProducts = DiversityHelper.maximalMarginalRelevance(
        scoredProducts, 0.7, limit * 2
      );

      // 12. Take top N — enrich products with recommendation metadata.
      //     matchScore giờ là điểm TUYỆT ĐỐI (finalScore ∈ [0,1] × 100), không còn
      //     chuẩn hóa theo maxScore cục bộ nên top-1 không mặc nhiên = 100%.
      const topItems = diverseProducts.slice(0, limit);

      const recommendations = topItems.map(item => ({
        ...item.product,
        ...this.buildMatchMeta(item.finalScore),
        recommendationReasons: this.generateRecommendationReasons(item),
        recommendationGroup: this.classifyRecommendationGroup(item)
      }));

      // Cache results
      if (enableCache) {
        this.cache.set(cacheKey, recommendations);
      }

      return recommendations;

    } catch (error) {
      console.error("Recommendation error:", error);

      // Fallback: return popular products
      const popularProducts = await Product.find({ isActive: true })
        .sort({ averageRating: -1, totalReviews: -1 })
        .limit(limit)
        .lean();

      return popularProducts.map(p => ({
        ...p,
        matchScore: 0,
        recommendationReasons: ["Sản phẩm phổ biến"],
        recommendationGroup: "popular"
      }));
    }
  }

  /**
   * Generate human-readable recommendation reasons from scoring data.
   *
   * REFACTORED: Thay vì chuỗi if-else tuần tự (khiến reason đầu tiên luôn lấn
   * át), giờ gom TẤT CẢ reasons thỏa ngưỡng tối thiểu vào mảng candidates rồi
   * sắp xếp theo score giảm dần → top 3 reasons luôn là những lý do NỔI BẬT NHẤT
   * của sản phẩm, không phụ thuộc thứ tự khai báo.
   *
   * Ngưỡng đã được cân chỉnh lại:
   * - contentScore:  0.6  → 0.75 (tránh gần như mọi SP đều lọt)
   * - seasonal:      0.9  → 0.8  (cho "all_season" cũng đạt)
   * - freshness:     0.9  → 0.8  (SP mới trong 30 ngày cũng đạt)
   * - discount:      0.8  → 0.7  (SP giảm ≥ 10% cũng đạt)
   */
  generateRecommendationReasons(scoredItem) {
    const bd = scoredItem.ruleBreakdown || {};

    // Mỗi candidate thuộc một `category` ngữ nghĩa. Khi chọn top 3, chỉ lấy
    // TỐI ĐA 1 reason / category để tránh trùng lặp kiểu:
    //   "Phù hợp phong cách" + "Đúng phong cách" + "Phù hợp dịp" (cùng nhóm style).
    //
    // Categories:
    //   style      — sở thích phong cách / dịp (content similarity, style rule, occasion rule)
    //   social     — tín hiệu cộng đồng (collaborative filtering, popularity)
    //   behavior   — lịch sử duyệt web cá nhân (category, behavior weight)
    //   value      — giá & ưu đãi (price range, discount)
    //   timeliness — tính thời điểm (seasonal, freshness)
    //   wishlist   — danh sách yêu thích
    const candidateRules = [
      { reason: "Phù hợp phong cách của bạn",    score: scoredItem.contentScore,       threshold: 0.75, category: "style" },
      { reason: "Đúng phong cách bạn yêu thích", score: bd.style,                      threshold: 0.8,  category: "style" },
      { reason: "Phù hợp dịp bạn quan tâm",     score: bd.occasion,                   threshold: 0.7,  category: "style" },
      { reason: "Người mua tương tự cũng thích", score: scoredItem.collaborativeScore,  threshold: 0.4,  category: "social" },
      { reason: "Được nhiều người yêu thích",    score: scoredItem.popularityScore,     threshold: 0.75, category: "social" },
      { reason: "Danh mục bạn hay xem",          score: scoredItem.categoryScore,       threshold: 0.7,  category: "behavior" },
      { reason: "Dựa trên sản phẩm bạn đã xem", score: scoredItem.behaviorWeight,      threshold: 0.6,  category: "behavior" },
      { reason: "Phù hợp tầm giá của bạn",      score: bd.priceRange,                  threshold: 0.8,  category: "value" },
      { reason: "Đang có ưu đãi tốt",           score: bd.discount,                    threshold: 0.7,  category: "value" },
      { reason: "Phù hợp mùa hiện tại",         score: bd.seasonal,                    threshold: 0.8,  category: "timeliness" },
      { reason: "Sản phẩm mới về",              score: bd.freshness,                    threshold: 0.8,  category: "timeliness" },
      { reason: "Trong danh sách yêu thích",    score: bd.wishlist,                     threshold: 0.9,  category: "wishlist" }
    ];

    // Lọc candidates thỏa ngưỡng, sắp xếp theo score giảm dần
    const qualified = candidateRules
      .filter(c => (c.score ?? 0) >= c.threshold)
      .sort((a, b) => b.score - a.score);

    // Chọn top 3 với ràng buộc: tối đa 1 reason / category
    const usedCategories = new Set();
    const topReasons = [];
    for (const c of qualified) {
      if (topReasons.length >= 3) break;
      if (usedCategories.has(c.category)) continue; // đã có reason cùng nhóm → bỏ qua
      topReasons.push(c.reason);
      usedCategories.add(c.category);
    }

    if (topReasons.length === 0) {
      topReasons.push("Gợi ý dành cho bạn");
    }

    return topReasons;
  }

  /**
   * Classify product into a recommendation group for UI grouping.
   *
   * REFACTORED: Thay vì if-else chain (khiến group đầu tiên luôn thắng), giờ
   * so sánh TẤT CẢ các nhóm điểm và chọn nhóm có Dominant Score cao nhất.
   * Nếu tất cả đều thấp hoặc bằng nhau → fallback "for_you".
   */
  classifyRecommendationGroup(scoredItem) {
    const bd = scoredItem.ruleBreakdown || {};

    // Mỗi group được đại diện bởi một score (hoặc max của nhiều scores liên quan)
    const groupScores = [
      { group: "style_match",      score: Math.max(scoredItem.contentScore || 0, bd.style || 0) },
      { group: "similar_users",    score: scoredItem.collaborativeScore || 0 },
      { group: "browsing_history", score: Math.max(scoredItem.behaviorWeight || 0, scoredItem.categoryScore || 0) },
      { group: "popular",          score: scoredItem.popularityScore || 0 },
      { group: "new_arrivals",     score: bd.freshness || 0 },
      { group: "deals",            score: bd.discount || 0 }
    ];

    // Sắp xếp theo score giảm dần, lấy group có điểm cao nhất
    groupScores.sort((a, b) => b.score - a.score);

    const best = groupScores[0];

    // Ngưỡng tối thiểu: nếu dominant score quá thấp thì fallback
    if (best.score < 0.4) {
      return "for_you";
    }

    return best.group;
  }

  /**
   * Chuyển một điểm hợp nhất đã chuẩn hóa về [0,1] thành metadata cho badge "Match %".
   *
   * TUYỆT ĐỐI HÓA: matchScore = score × 100, KHÔNG chia cho maxScore cục bộ → item
   * top-1 không còn mặc nhiên = 100%; con số phản ánh đúng độ phù hợp tuyệt đối.
   *
   * Vì finalScore là tổ hợp lồi (các trọng số cộng lại = 1) của những điểm con đều
   * thuộc [0,1], nên finalScore ∈ [0,1] và (× 100) cho ra ngay thang phần trăm.
   * Math.min/Math.max chỉ là lớp phòng vệ chống lệch dải do sai số dấu phẩy động.
   *
   * @param {number} score01 - Điểm hợp nhất, kỳ vọng ∈ [0, 1]
   * @returns {{ matchScore: number|null, isHighMatch: boolean }}
   */
  buildMatchMeta(score01) {
    const safeScore = Number.isFinite(score01) ? score01 : 0;
    const clamped = Math.min(Math.max(safeScore, 0), 1);
    const absoluteMatch = Math.round(clamped * 100);
    const isHighMatch = absoluteMatch >= MIN_MATCH_THRESHOLD;

    return {
      // Dưới ngưỡng → null để Frontend ẩn badge. Điều kiện `matchScore > 0` sẵn có
      // ở ProductCard coi null là falsy nên KHÔNG cần sửa Frontend.
      matchScore: isHighMatch ? absoluteMatch : null,
      isHighMatch
    };
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
          score: similarity * boost,
          rawSimilarity: similarity
        };
      });

      // Sort and take top N.
      // matchScore dựa trên rawSimilarity (cosine ∈ [0,1]) — độ tương đồng THẬT,
      // KHÔNG dùng score đã nhân boost (boost chỉ phục vụ xếp hạng, không phải %match).
      similarities.sort((a, b) => b.score - a.score);
      const topItems = similarities.slice(0, limit);
      const recommendations = topItems.map(item => ({
        ...item.product,
        ...this.buildMatchMeta(item.rawSimilarity),
        recommendationReasons: ["Sản phẩm tương tự"],
        recommendationGroup: "similar_products"
      }));

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

      const popularProducts = await Product.find({
        isActive: true,
        categoryId: targetProduct.categoryId,
        _id: { $ne: productId }
      })
        .sort({ averageRating: -1 })
        .limit(limit)
        .lean();

      return popularProducts.map(p => ({
        ...p,
        matchScore: 0,
        recommendationReasons: ["Sản phẩm cùng danh mục"],
        recommendationGroup: "similar_products"
      }));
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
                        b.actionType === "add_to_wishlist" ? 2 : 1;
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
        const popularProducts = await Product.find({ isActive: true })
          .sort({ averageRating: -1, totalReviews: -1 })
          .limit(limit)
          .lean();

        const popular = popularProducts.map(p => ({
          ...p,
          matchScore: 0,
          recommendationReasons: ["Sản phẩm phổ biến"],
          recommendationGroup: "trending"
        }));

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

      const topItems = products
        .map(p => ({
          product: p,
          score: productInteractions[p._id.toString()] || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Trending là XẾP HẠNG PHỔ BIẾN TOÀN CỤC (đếm tương tác, không có trần lý
      // thuyết), KHÔNG phải độ phù hợp cá nhân hóa → không gán "% MATCH" để tránh
      // lặp lại đúng kiểu lừa "top = 100%". Reason "Đang thịnh hành" đã đủ giải thích.
      const sorted = topItems.map(item => ({
        ...item.product,
        matchScore: null,
        isHighMatch: false,
        recommendationReasons: ["Đang thịnh hành"],
        recommendationGroup: "trending"
      }));

      if (enableCache) {
        this.cache.set(cacheKey, sorted);
      }

      return sorted;

    } catch (error) {
      console.error("Trending products error:", error);
      const popularProducts = await Product.find({ isActive: true })
        .sort({ averageRating: -1 })
        .limit(limit)
        .lean();

      return popularProducts.map(p => ({
        ...p,
        matchScore: 0,
        recommendationReasons: ["Sản phẩm phổ biến"],
        recommendationGroup: "trending"
      }));
    }
  }

  /**
   * Cold Start Recommendations — cho user mới (0 behaviors)
   *
   * Chiến lược: Exploit (70%) + Explore (30%)
   * - Exploit: Sản phẩm phổ biến trong nhóm users cùng gender
   * - Explore: Đa dạng từ nhiều categories/styles khác nhau
   * - Boost: Sản phẩm mới + đang sale + phù hợp mùa
   *
   * @param {Object} user - User object
   * @param {Array} products - Tất cả products (chưa filter)
   * @param {number} limit - Số lượng kết quả
   * @param {Object} filters - Hard filters
   * @returns {Array} Recommendations
   */
  async getColdStartRecommendations(user, products, limit, filters = {}) {
    // Apply hard filters
    let filteredProducts = RuleBasedEngine.applyHardFilters(products, {
      gender: user.gender,
      ...filters
    });

    if (filteredProducts.length === 0) {
      filteredProducts = products;
    }

    const exploitCount = Math.ceil(limit * 0.7);  // 70% exploit
    const exploreCount = limit - exploitCount;     // 30% explore

    // --- EXPLOIT: Sản phẩm phổ biến trong demographic của user ---
    // Tìm behaviors của users cùng gender trong 30 ngày gần đây
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let demographicBehaviors = [];

    try {
      // Lấy danh sách productIds phổ biến từ users cùng gender
      demographicBehaviors = await UserBehavior.aggregate([
        {
          $match: {
            actionType: { $in: ["purchase", "add_to_cart", "add_to_wishlist"] },
            createdAt: { $gte: thirtyDaysAgo },
            productId: { $ne: null }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo"
          }
        },
        {
          $match: user.gender ? { "userInfo.gender": user.gender } : {}
        },
        {
          $group: {
            _id: "$productId",
            score: {
              $sum: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$actionType", "purchase"] }, then: 5 },
                    { case: { $eq: ["$actionType", "add_to_cart"] }, then: 3 },
                    { case: { $eq: ["$actionType", "add_to_wishlist"] }, then: 2 }
                  ],
                  default: 1
                }
              }
            }
          }
        },
        { $sort: { score: -1 } },
        { $limit: exploitCount * 3 } // Lấy dư để filter
      ]);
    } catch (err) {
      console.error("Cold start demographic query error:", err);
    }

    // Map demographic product IDs và tìm trong filteredProducts
    const demographicIds = new Set(
      demographicBehaviors.map(d => d._id.toString())
    );
    const productMap = new Map(
      filteredProducts.map(p => [p._id.toString(), p])
    );

    // Score tất cả filtered products cho cold start
    const scoredProducts = filteredProducts.map(product => {
      const pid = product._id.toString();
      let score = 0;

      // Demographic popularity boost
      const demoBehavior = demographicBehaviors.find(d => d._id.toString() === pid);
      if (demoBehavior) {
        score += Math.min(Math.log1p(demoBehavior.score) / Math.log1p(50), 1.0) * 0.4;
      }

      // General popularity
      score += RuleBasedEngine.calculatePopularityScore(product) * 0.2;

      // Seasonal match
      score += RuleBasedEngine.calculateSeasonalScore(product) * 0.15;

      // Freshness (new arrivals boost)
      score += RuleBasedEngine.calculateFreshnessScore(product) * 0.15;

      // Discount attraction
      score += RuleBasedEngine.calculateDiscountScore(product) * 0.1;

      return { product, finalScore: score };
    });

    // Sort và lấy exploit products
    scoredProducts.sort((a, b) => b.finalScore - a.finalScore);
    const exploitProducts = scoredProducts.slice(0, exploitCount);

    // --- EXPLORE: Đa dạng từ categories/styles khác nhau ---
    const usedIds = new Set(exploitProducts.map(p => p.product._id.toString()));
    const usedCategories = new Set(exploitProducts.map(p => p.product.categoryId?.toString()));
    const usedStyles = new Set();
    exploitProducts.forEach(p => {
      const styles = Array.isArray(p.product.style) ? p.product.style : [p.product.style];
      styles.forEach(s => usedStyles.add(s));
    });

    // Lấy products từ categories/styles CHƯA có trong exploit
    const explorePool = scoredProducts.filter(p => {
      const pid = p.product._id.toString();
      const catId = p.product.categoryId?.toString();
      const styles = Array.isArray(p.product.style) ? p.product.style : [p.product.style];
      const hasNewStyle = styles.some(s => !usedStyles.has(s));
      const hasNewCategory = !usedCategories.has(catId);

      return !usedIds.has(pid) && (hasNewCategory || hasNewStyle);
    });

    const exploreProducts = explorePool.slice(0, exploreCount);

    // Kết hợp và xen kẽ (interleave) để user không nhận ra pattern
    const combined = [];
    let ei = 0, xi = 0;
    for (let i = 0; i < limit; i++) {
      if (i % 3 === 2 && xi < exploreProducts.length) {
        // Mỗi 3 products, chèn 1 explore
        combined.push(exploreProducts[xi++]);
      } else if (ei < exploitProducts.length) {
        combined.push(exploitProducts[ei++]);
      } else if (xi < exploreProducts.length) {
        combined.push(exploreProducts[xi++]);
      }
    }

    // Nếu chưa đủ limit, bổ sung từ remaining
    if (combined.length < limit) {
      const usedFinalIds = new Set(combined.map(p => p.product._id.toString()));
      const remaining = scoredProducts.filter(p => !usedFinalIds.has(p.product._id.toString()));
      combined.push(...remaining.slice(0, limit - combined.length));
    }

    return combined.slice(0, limit).map(item => ({
      ...item.product,
      ...this.buildMatchMeta(item.finalScore),
      recommendationReasons: ["Phổ biến trong nhóm của bạn"],
      recommendationGroup: "popular"
    }));
  }

  /**
   * Clear cache (recommendation cache + collaborative matrix nếu cần)
   */
  clearCache(userId = null) {
    if (userId) {
      const keys = this.cache.keys();
      keys.forEach(key => {
        if (key.includes(userId.toString())) {
          this.cache.del(key);
        }
      });
      // Không invalidate co-occurrence matrix mỗi khi user có hành vi mới
      // vì matrix tốn chi phí rebuild — chỉ invalidate khi clear toàn bộ
    } else {
      this.cache.flushAll();
      this.collaborativeEngine.clearMatrixCache();
    }
  }

  /**
   * Personalized Bestsellers — Bán chạy trong phong cách của bạn
   *
   * Chiến lược: Giữ bản chất "bán chạy" (soldCount chiếm 40%)
   * nhưng re-rank theo sở thích cá nhân (category 25%, style 20%, popularity 15%).
   * Cold start (0 behaviors) → fallback về bestsellers đại trà.
   *
   * @param {Object} user - User object
   * @param {Object} options - { limit }
   * @returns {Array} Personalized bestseller products
   */
  async getPersonalizedBestsellers(user, options = {}) {
    const { limit = 12, enableCache = true } = options;

    const cacheKey = `pers_best_${user._id}_${limit}`;
    if (enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      // 1. Fetch data
      const [behaviors, products] = await Promise.all([
        UserBehavior.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        Product.find({ isActive: true }).lean()
      ]);

      // Cold start → fallback đại trà (sort by soldCount via aggregation)
      if (!behaviors || behaviors.length === 0) {
        const filtered = RuleBasedEngine.applyHardFilters(products, { gender: user.gender });
        return this._getUnpersonalizedBestsellers(filtered.length > 0 ? filtered : products, limit);
      }

      // 2. Apply gender hard filter
      let filteredProducts = RuleBasedEngine.applyHardFilters(products, { gender: user.gender });
      if (filteredProducts.length === 0) filteredProducts = products;

      // 3. Extract preferences
      const preferredCategories = CategoryFilter.extractPreferredCategories(behaviors, filteredProducts);
      const preferredStyles = this.userProfileBuilder.extractStylePreferences(behaviors, filteredProducts);

      // 4. Compute soldCount via aggregation (exclude cancelled orders)
      const productIds = filteredProducts.map(p => p._id);
      const soldRows = await OrderItem.aggregate([
        { $match: { productId: { $in: productIds } } },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order"
          }
        },
        { $unwind: "$order" },
        { $match: { "order.status": { $ne: "cancelled" } } },
        { $group: { _id: "$productId", soldCount: { $sum: "$quantity" } } }
      ]);
      const soldMap = new Map(soldRows.map(r => [r._id.toString(), r.soldCount]));

      // 5. Filter: only products with sales
      const bestsellers = filteredProducts
        .map(p => ({ ...p, soldCount: soldMap.get(p._id.toString()) || 0 }))
        .filter(p => p.soldCount > 0);

      if (bestsellers.length === 0) {
        return [];
      }

      // 6. Normalize soldCount to [0,1]
      const maxSold = Math.max(...bestsellers.map(p => p.soldCount));

      // 7. Score with hybrid weights
      const scored = bestsellers.map(product => {
        const soldNorm = maxSold > 0 ? product.soldCount / maxSold : 0;
        const categoryScore = this._calculateCategoryMatch(product, preferredCategories);
        const styleScore = this._calculateStyleMatch(product, preferredStyles);
        const popularityScore = RuleBasedEngine.calculatePopularityScore(product);

        const finalScore =
          soldNorm       * 0.25 +
          categoryScore  * 0.30 +
          styleScore     * 0.30 +
          popularityScore * 0.15;

        return { product, finalScore, soldNorm, categoryScore, styleScore };
      });

      scored.sort((a, b) => b.finalScore - a.finalScore);
      const topItems = scored.slice(0, limit);

      const results = topItems.map(item => ({
        ...item.product,
        matchScore: null,
        isHighMatch: false,
        recommendationReasons: this._buildBestsellerReasons(item),
        recommendationGroup: "personalized_bestseller"
      }));

      if (enableCache) {
        this.cache.set(cacheKey, results);
      }

      return results;
    } catch (error) {
      console.error("Personalized bestsellers error:", error);
      // Fallback
      const products = await Product.find({ isActive: true }).lean();
      return this._getUnpersonalizedBestsellers(products, limit);
    }
  }

  /**
   * Personalized New Arrivals — Sản phẩm mới phù hợp với gu của bạn
   *
   * Chiến lược: Freshness chiếm 35% (giữ bản chất "mới"),
   * style 30%, category 20%, seasonal 15%.
   * Cold start (0 behaviors) → fallback về new arrivals đại trà.
   *
   * @param {Object} user - User object
   * @param {Object} options - { limit, daysBack }
   * @returns {Array} Personalized new arrival products
   */
  async getPersonalizedNewArrivals(user, options = {}) {
    const { limit = 12, daysBack = 60, enableCache = true } = options;

    const cacheKey = `pers_new_${user._id}_${limit}`;
    if (enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      // 1. Fetch data
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      const [behaviors, newProducts] = await Promise.all([
        UserBehavior.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        Product.find({
          isActive: true,
          createdAt: { $gte: cutoffDate }
        })
          .sort({ createdAt: -1 })
          .lean()
      ]);

      // Cold start → fallback đại trà (sort by createdAt) — vẫn lọc gender
      if (!behaviors || behaviors.length === 0) {
        const genderFiltered = RuleBasedEngine.applyHardFilters(newProducts, { gender: user.gender });
        const coldStartProducts = genderFiltered.length > 0 ? genderFiltered : newProducts;
        const results = coldStartProducts.slice(0, limit).map(p => ({
          ...p,
          matchScore: null,
          isHighMatch: false,
          recommendationReasons: ["Sản phẩm mới về"],
          recommendationGroup: "new_arrival"
        }));
        if (enableCache) this.cache.set(cacheKey, results);
        return results;
      }

      // 2. Apply gender hard filter
      let filteredNewProducts = RuleBasedEngine.applyHardFilters(newProducts, { gender: user.gender });
      if (filteredNewProducts.length === 0) filteredNewProducts = newProducts;

      if (filteredNewProducts.length === 0) return [];

      // 3. Extract preferences — dùng ALL products cho context đầy đủ
      const allProducts = await Product.find({ isActive: true }).lean();
      const filteredAllProducts = RuleBasedEngine.applyHardFilters(allProducts, { gender: user.gender });
      const preferredCategories = CategoryFilter.extractPreferredCategories(behaviors, filteredAllProducts.length > 0 ? filteredAllProducts : allProducts);
      const preferredStyles = this.userProfileBuilder.extractStylePreferences(behaviors, filteredAllProducts.length > 0 ? filteredAllProducts : allProducts);

      // 4. Score new products
      const scored = filteredNewProducts.map(product => {
        const freshnessScore = RuleBasedEngine.calculateFreshnessScore(product);
        const styleScore = this._calculateStyleMatch(product, preferredStyles);
        const categoryScore = this._calculateCategoryMatch(product, preferredCategories);
        const seasonalScore = RuleBasedEngine.calculateSeasonalScore(product);

        const finalScore =
          freshnessScore  * 0.20 +
          styleScore      * 0.35 +
          categoryScore   * 0.30 +
          seasonalScore   * 0.15;

        return { product, finalScore, freshnessScore, styleScore, categoryScore };
      });

      scored.sort((a, b) => b.finalScore - a.finalScore);
      const topItems = scored.slice(0, limit);

      const results = topItems.map(item => ({
        ...item.product,
        matchScore: null,
        isHighMatch: false,
        recommendationReasons: this._buildNewArrivalReasons(item),
        recommendationGroup: "personalized_new_arrival"
      }));

      if (enableCache) {
        this.cache.set(cacheKey, results);
      }

      return results;
    } catch (error) {
      console.error("Personalized new arrivals error:", error);
      // Fallback: sort by createdAt
      const fallback = await Product.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return fallback.map(p => ({
        ...p,
        matchScore: null,
        isHighMatch: false,
        recommendationReasons: ["Sản phẩm mới về"],
        recommendationGroup: "new_arrival"
      }));
    }
  }

  /**
   * Calculate style match between a product and user's preferred styles
   * @returns {number} 0–1
   */
  _calculateStyleMatch(product, preferredStyles) {
    if (!preferredStyles || preferredStyles.length === 0) return 0.5;

    const productStyles = Array.isArray(product.style)
      ? product.style
      : [product.style].filter(Boolean);

    if (productStyles.length === 0) return 0.05;

    const matchCount = productStyles.filter(s => preferredStyles.includes(s)).length;
    if (matchCount === 0) return 0.05;

    // Partial match: 0.75, full match: 1.0
    return matchCount >= productStyles.length ? 1.0 : 0.75;
  }

  /**
   * Calculate category match with high contrast scoring
   * Used by personalized sections — stricter than CategoryFilter.calculateCategoryScore
   * to create visible differentiation in results.
   * @returns {number} 1.0 (match), 0.05 (no match)
   */
  _calculateCategoryMatch(product, preferredCategoryIds) {
    if (!preferredCategoryIds || preferredCategoryIds.length === 0) return 0.5;

    const productCategoryId = product.categoryId?.toString();
    if (preferredCategoryIds.includes(productCategoryId)) {
      return 1.0;
    }

    return 0.05;
  }

  /**
   * Build recommendation reasons for personalized bestseller items
   */
  _buildBestsellerReasons(scoredItem) {
    const reasons = [];
    if (scoredItem.categoryScore >= 0.8) reasons.push("Bán chạy trong danh mục bạn hay xem");
    if (scoredItem.styleScore >= 0.7) reasons.push("Phù hợp phong cách của bạn");
    if (reasons.length === 0) reasons.push("Được nhiều người mua");
    return reasons.slice(0, 2);
  }

  /**
   * Build recommendation reasons for personalized new arrival items
   */
  _buildNewArrivalReasons(scoredItem) {
    const reasons = [];
    if (scoredItem.freshnessScore >= 0.8) reasons.push("Mới về gần đây");
    if (scoredItem.styleScore >= 0.7) reasons.push("Phù hợp gu của bạn");
    if (scoredItem.categoryScore >= 0.8) reasons.push("Danh mục bạn quan tâm");
    if (reasons.length === 0) reasons.push("Sản phẩm mới về");
    return reasons.slice(0, 2);
  }

  /**
   * Fallback: unpersonalized bestsellers (used for cold start)
   */
  async _getUnpersonalizedBestsellers(products, limit) {
    const productIds = products.map(p => p._id);
    const soldRows = await OrderItem.aggregate([
      { $match: { productId: { $in: productIds } } },
      { $group: { _id: "$productId", soldCount: { $sum: "$quantity" } } }
    ]);
    const soldMap = new Map(soldRows.map(r => [r._id.toString(), r.soldCount]));

    return products
      .map(p => ({ ...p, soldCount: soldMap.get(p._id.toString()) || 0 }))
      .filter(p => p.soldCount > 0)
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, limit)
      .map(p => ({
        ...p,
        matchScore: null,
        isHighMatch: false,
        recommendationReasons: ["Được nhiều người mua"],
        recommendationGroup: "bestseller"
      }));
  }

  /**
   * Clear cache (recommendation cache + collaborative matrix nếu cần)
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
      this.collaborativeEngine.clearMatrixCache();
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

/**
 * Get personalized bestsellers for user
 */
export const getPersonalizedBestsellers = async (user, limitParam) => {
  const limit = Math.min(parseInt(limitParam) || 12, 50);
  return recommendationEngine.getPersonalizedBestsellers(user, { limit });
};

/**
 * Get personalized new arrivals for user
 */
export const getPersonalizedNewArrivals = async (user, limitParam) => {
  const limit = Math.min(parseInt(limitParam) || 12, 50);
  return recommendationEngine.getPersonalizedNewArrivals(user, { limit });
};

export default recommendationEngine;
