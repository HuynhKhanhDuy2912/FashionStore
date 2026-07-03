import Product from "../models/Product.js";
import Category from "../models/Category.js";
import NodeCache from "node-cache";
import { ProductFeatureExtractor } from "./featureExtraction.service.js";

/**
 * Outfit Recommendation Engine — Complementary Product Suggestions
 *
 * Gợi ý các sản phẩm BỔ SUNG (complementary) thay vì tương đồng (similar):
 * "Áo thun casual này nên đi kèm Quần jean nào + Giày nào?"
 *
 * Khác biệt với Content-Based Filtering:
 * - Content-Based: tìm sản phẩm GIỐNG user profile → Substitute Recommendation
 * - Outfit Engine: tìm sản phẩm KHÁC category nhưng COMPATIBLE → Complementary Recommendation
 *
 * - top:    Áo (thun, sơ mi, polo, len, khoác, tank top, hoodie)
 * - bottom: Quần / Váy rời (jean, kaki, tây, short, chân váy)
 * - one_piece: Đầm / Váy liền (váy, đầm) — chỉ đi kèm giày
 * - shoes:  Giày (sneaker, boot, sandal, tây, dép) — mở rộng khi có data
 */
export class OutfitRecommendationEngine {
  constructor() {
    // Cache category-to-slot mapping (rarely changes)
    this.slotCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
    this.SLOT_CACHE_KEY = "category_slot_map";

    this.featureExtractor = new ProductFeatureExtractor();

    /**
     * Keyword patterns để map category name → outfit slot.
     * Dùng keyword matching thay vì hardcode ObjectId vì:
     * 1. Không phụ thuộc vào DB seed cụ thể
     * 2. Tự động nhận diện category mới nếu tên phù hợp
     * 3. Hỗ trợ cả tiếng Việt và tiếng Anh
     */
    this.slotKeywords = {
      top: [
        "áo",
        "shirt",
        "polo",
        "hoodie",
        "jacket",
        "khoác",
        "sweater",
        "vest",
        "len",
        "tank top",
        "sơ mi",
        "thun",
      ],
      bottom: [
        "quần",
        "pants",
        "jeans",
        "jean",
        "shorts",
        "short",
        "chân váy",
        "skirt",
        "kaki",
        "tây",
      ],
      one_piece: ["đầm", "váy", "dress"],
      shoes: [
        "giày",
        "dép",
        "sandal",
        "boot",
        "sneaker",
        "shoe",
        "footwear",
        "cao gót",
        "giày tây",
        "lười",
      ],
    };

    /**
     * Complementary slot rules: slot A → nên đi kèm slots nào
     * Ưu tiên order: slot đầu tiên quan trọng nhất
     */
    this.complementarySlots = {
      top: ["bottom", "shoes"],
      bottom: ["top", "shoes"],
      one_piece: ["shoes"],
      shoes: ["top", "bottom", "one_piece"],
    };
  }

  /**
   * Xác định outfit slot cho 1 category dựa trên tên.
   * Duyệt qua slotKeywords, lowercase matching.
   *
   * @param {string} categoryName - Tên category (VD: "Áo Thun Nam")
   * @returns {string|null} Slot name hoặc null nếu không nhận diện được
   */
  _getCategorySlot(categoryName) {
    if (!categoryName) return null;
    const lower = categoryName.toLowerCase();

    for (const [slot, keywords] of Object.entries(this.slotKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return slot;
      }
    }
    return null;
  }

  /**
   * Build bảng mapping categoryId → slot cho tất cả categories.
   * Cache 1 giờ vì categories hiếm khi thay đổi.
   *
   * @returns {Map<string, string>} categoryId → slot
   */
  async _getCategorySlotMap() {
    const cached = this.slotCache.get(this.SLOT_CACHE_KEY);
    if (cached) return cached;

    const categories = await Category.find({}).select("name").lean();
    const slotMap = new Map();

    categories.forEach((cat) => {
      const slot = this._getCategorySlot(cat.name);
      if (slot) {
        slotMap.set(cat._id.toString(), slot);
      }
    });

    this.slotCache.set(this.SLOT_CACHE_KEY, slotMap);
    return slotMap;
  }

  /**
   * Tính Complementary Score giữa seed product và candidate product.
   *
   * Khác với Content-Based (tìm GIỐNG), ở đây:
   * - Style phải TƯƠNG ĐỒNG (casual áo + casual quần = tốt)
   * - Occasion phải OVERLAP (cả 2 đều cho "street" = tốt)
   * - Season phải COMPATIBLE (cả 2 đều cho "summer" = tốt)
   * - Price phải CÂN ĐỐI (cùng tầm giá ± 100%)
   *
   * @param {Object} seedProduct - Sản phẩm gốc
   * @param {Object} candidateProduct - Sản phẩm ứng viên
   * @returns {number} Score ∈ [0, 1]
   */
  calculateComplementaryScore(seedProduct, candidateProduct) {
    // 1. Style Compatibility — cosine similarity trên 2D style embedding
    const seedStyles = Array.isArray(seedProduct.style)
      ? seedProduct.style
      : [seedProduct.style || "casual"];
    const candStyles = Array.isArray(candidateProduct.style)
      ? candidateProduct.style
      : [candidateProduct.style || "casual"];

    const seedStyleEmb = this._getAverageStyleEmbedding(seedStyles);
    const candStyleEmb = this._getAverageStyleEmbedding(candStyles);
    const styleScore = this._cosine2D(seedStyleEmb, candStyleEmb);

    // 2. Occasion Alignment — overlap ratio
    const seedOccasions = seedProduct.occasion || [];
    const candOccasions = candidateProduct.occasion || [];
    const occasionOverlap = seedOccasions.filter((o) =>
      candOccasions.includes(o),
    ).length;
    const maxOccasions = Math.max(
      seedOccasions.length,
      candOccasions.length,
      1,
    );
    const occasionScore = Math.min(
      occasionOverlap / Math.min(maxOccasions, 2),
      1.0,
    );

    // 3. Season Compatibility — có overlap mùa không
    const seedSeasons = seedProduct.season || ["all_season"];
    const candSeasons = candidateProduct.season || ["all_season"];
    const hasAllSeason =
      seedSeasons.includes("all_season") || candSeasons.includes("all_season");
    const seasonOverlap = seedSeasons.some((s) => candSeasons.includes(s));
    const seasonScore = hasAllSeason ? 0.8 : seasonOverlap ? 1.0 : 0.3;

    // 4. Price Balance — cùng tầm giá ± 100%
    const seedPrice =
      seedProduct.price * (1 - (seedProduct.discount || 0) / 100);
    const candPrice =
      candidateProduct.price * (1 - (candidateProduct.discount || 0) / 100);
    const priceRatio = seedPrice > 0 ? candPrice / seedPrice : 1;
    let priceScore;
    if (priceRatio >= 0.5 && priceRatio <= 2.0) {
      priceScore = 1.0;
    } else if (priceRatio >= 0.3 && priceRatio <= 3.0) {
      priceScore = 0.6;
    } else {
      priceScore = 0.3;
    }

    // Weighted sum
    return (
      styleScore * 0.35 +
      occasionScore * 0.3 +
      seasonScore * 0.15 +
      priceScore * 0.2
    );
  }

  /**
   * Lấy average 2D style embedding cho mảng styles
   */
  _getAverageStyleEmbedding(styles) {
    const embeddings = this.featureExtractor.styleEmbeddings;
    const defaultEmb = [0.1, 0.3]; // casual default

    if (!styles || styles.length === 0) return defaultEmb;

    const sum = [0, 0];
    let count = 0;
    styles.forEach((s) => {
      const emb = embeddings[s] || defaultEmb;
      sum[0] += emb[0];
      sum[1] += emb[1];
      count++;
    });

    return count > 0 ? [sum[0] / count, sum[1] / count] : defaultEmb;
  }

  /**
   * Cosine similarity cho 2D vectors
   */
  _cosine2D(a, b) {
    const dot = a[0] * b[0] + a[1] * b[1];
    const normA = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
    const normB = Math.sqrt(b[0] * b[0] + b[1] * b[1]);
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  /**
   * Sinh lý do gợi ý cho outfit item
   */
  _buildOutfitReasons(seedProduct, candidateProduct, score) {
    const reasons = [];

    // Style match
    const seedStyles = Array.isArray(seedProduct.style)
      ? seedProduct.style
      : [seedProduct.style];
    const candStyles = Array.isArray(candidateProduct.style)
      ? candidateProduct.style
      : [candidateProduct.style];
    if (seedStyles.some((s) => candStyles.includes(s))) {
      reasons.push("Cùng phong cách");
    }

    // Occasion match
    const seedOccasions = seedProduct.occasion || [];
    const candOccasions = candidateProduct.occasion || [];
    if (seedOccasions.some((o) => candOccasions.includes(o))) {
      reasons.push("Phù hợp dịp sử dụng");
    }

    // Price balance
    const seedPrice =
      seedProduct.price * (1 - (seedProduct.discount || 0) / 100);
    const candPrice =
      candidateProduct.price * (1 - (candidateProduct.discount || 0) / 100);
    const ratio = seedPrice > 0 ? candPrice / seedPrice : 1;
    if (ratio >= 0.5 && ratio <= 2.0) {
      reasons.push("Cùng tầm giá");
    }

    if (reasons.length === 0) {
      reasons.push("Phối hợp tốt");
    }

    return reasons.slice(0, 2);
  }

  /**
   * Main method: Gợi ý outfit cho 1 sản phẩm.
   *
   * Luồng:
   * 1. Xác định slot của seed product (top/bottom/shoes/accessory)
   * 2. Lấy tất cả products thuộc complementary slots
   * 3. Tính complementary score cho từng candidate
   * 4. Group theo slot, mỗi slot lấy top N
   * 5. Return outfit set
   *
   * @param {string} productId - ID sản phẩm gốc
   * @param {Object|null} user - User object (null nếu guest)
   * @param {Object} options - { limit }
   * @returns {Object} { seed, outfitItems, outfitStyle, outfitOccasions }
   */
  async getOutfitRecommendations(productId, user = null, options = {}) {
    const { limit = 8 } = options;

    try {
      // 1. Fetch seed product + category + slot map
      const [seedProduct, slotMap] = await Promise.all([
        Product.findById(productId).populate("categoryId", "name").lean(),
        this._getCategorySlotMap(),
      ]);

      if (!seedProduct) {
        return {
          seed: null,
          outfitItems: [],
          outfitStyle: null,
          outfitOccasions: [],
        };
      }

      // 2. Xác định slot của seed product
      const seedCatId =
        seedProduct.categoryId?._id?.toString() ||
        seedProduct.categoryId?.toString();
      const seedSlot =
        slotMap.get(seedCatId) ||
        this._getCategorySlot(seedProduct.categoryId?.name);

      if (!seedSlot) {
        return {
          seed: seedProduct,
          outfitItems: [],
          outfitStyle: null,
          outfitOccasions: [],
        };
      }

      // 3. Xác định complementary slots
      const targetSlots = this.complementarySlots[seedSlot] || [];
      if (targetSlots.length === 0) {
        return {
          seed: seedProduct,
          outfitItems: [],
          outfitStyle: null,
          outfitOccasions: [],
        };
      }

      // 4. Lấy tất cả active products (chỉ fields cần thiết)
      const allProducts = await Product.find({
        isActive: true,
        _id: { $ne: productId },
      })
        .populate("categoryId", "name")
        .select(
          "name price discount categoryId style occasion season gender images averageRating totalReviews slug",
        )
        .lean();

      // 5. Filter theo gender (nếu seed có gender cụ thể)
      let candidates = allProducts;
      if (seedProduct.gender && seedProduct.gender !== "") {
        candidates = candidates.filter(
          (p) =>
            !p.gender || p.gender === "" || p.gender === seedProduct.gender,
        );
      }

      // 6. Filter: chỉ lấy products thuộc complementary slots
      const complementaryCandidates = candidates.filter((p) => {
        const catId = p.categoryId?._id?.toString() || p.categoryId?.toString();
        const pSlot =
          slotMap.get(catId) || this._getCategorySlot(p.categoryId?.name);
        return pSlot && targetSlots.includes(pSlot);
      });

      if (complementaryCandidates.length === 0) {
        return {
          seed: seedProduct,
          outfitItems: [],
          outfitStyle: null,
          outfitOccasions: [],
        };
      }

      // 7. Score tất cả candidates
      const scored = complementaryCandidates.map((candidate) => {
        const catId =
          candidate.categoryId?._id?.toString() ||
          candidate.categoryId?.toString();
        const slot =
          slotMap.get(catId) ||
          this._getCategorySlot(candidate.categoryId?.name);
        const score = this.calculateComplementaryScore(seedProduct, candidate);

        return {
          product: candidate,
          slot,
          complementaryScore: score,
          reasons: this._buildOutfitReasons(seedProduct, candidate, score),
        };
      });

      // 8. Sort giảm dần
      scored.sort((a, b) => b.complementaryScore - a.complementaryScore);

      // 9. Group theo slot, mỗi slot lấy top items (đảm bảo diversity)
      // Tính số lượng slot thực tế có sản phẩm để chia đều limit
      const availableSlots = new Set(scored.map((item) => item.slot)).size;
      const actualTargetSlots =
        availableSlots > 0 ? availableSlots : targetSlots.length;
      const perSlotLimit = Math.max(Math.ceil(limit / actualTargetSlots), 2);
      const slotCounts = {};
      const outfitItems = [];

      for (const item of scored) {
        const count = slotCounts[item.slot] || 0;
        if (count >= perSlotLimit) continue;

        outfitItems.push({
          ...item.product,
          slot: item.slot,
          complementaryScore: Math.round(item.complementaryScore * 100),
          outfitReasons: item.reasons,
          recommendationReasons: item.reasons,
          recommendationGroup: "outfit",
        });

        slotCounts[item.slot] = count + 1;
        if (outfitItems.length >= limit) break;
      }

      // 10. Xác định outfit style và occasions
      const seedStyles = Array.isArray(seedProduct.style)
        ? seedProduct.style
        : [seedProduct.style || "casual"];
      const seedOccasions = seedProduct.occasion || ["casual"];

      return {
        seed: {
          _id: seedProduct._id,
          name: seedProduct.name,
          slot: seedSlot,
          style: seedStyles,
          occasion: seedOccasions,
        },
        outfitItems,
        outfitStyle: seedStyles[0] || "casual",
        outfitOccasions: seedOccasions,
      };
    } catch (error) {
      console.error("Outfit recommendation error:", error);
      return {
        seed: null,
        outfitItems: [],
        outfitStyle: null,
        outfitOccasions: [],
      };
    }
  }

  /**
   * Clear slot cache (khi categories thay đổi)
   */
  clearSlotCache() {
    this.slotCache.del(this.SLOT_CACHE_KEY);
  }
}
