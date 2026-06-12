import NodeCache from "node-cache";

/**
 * Item-Based Collaborative Filtering Engine
 *
 * Gợi ý sản phẩm dựa trên hành vi của TẤT CẢ users:
 * "Users tương tác với sản phẩm A cũng thường tương tác với sản phẩm B"
 *
 * Sử dụng Co-occurrence Matrix để tính điểm collaborative cho từng sản phẩm.
 */
export class ItemBasedCollaborativeEngine {
  constructor() {
    // Cache co-occurrence matrix for 30 minutes (tốn chi phí tính toán)
    this.matrixCache = new NodeCache({ stdTTL: 1800, checkperiod: 300 });
    this.MATRIX_CACHE_KEY = "co_occurrence_matrix";
  }

  /**
   * Xây dựng Co-occurrence Matrix từ tất cả positive behaviors
   *
   * Logic:
   * 1. Query tất cả behaviors dạng positive (purchase, add_to_cart, add_to_wishlist)
   * 2. Group theo userId → mỗi user có 1 Set<productId>
   * 3. Với mỗi user, đếm tất cả cặp (productA, productB) xuất hiện cùng nhau
   * 4. Kết quả: sparse matrix { "prodA_prodB": count }
   *
   * @param {Model} UserBehaviorModel - Mongoose model cho UserBehavior
   * @returns {Object} Co-occurrence matrix { pairKey: count }
   */
  async buildCoOccurrenceMatrix(UserBehaviorModel) {
    // Chỉ lấy positive behaviors — đây là signals cho thấy user quan tâm
    const positiveBehaviors = await UserBehaviorModel.find({
      actionType: {
        $in: ["purchase", "add_to_cart", "add_to_wishlist"]
      },
      productId: { $ne: null }
    })
      .select("userId productId actionType")
      .lean();

    // Group theo userId → Set<productId>
    const userProducts = {};
    positiveBehaviors.forEach((b) => {
      const uid = b.userId.toString();
      const pid = b.productId.toString();

      if (!userProducts[uid]) {
        userProducts[uid] = new Set();
      }
      userProducts[uid].add(pid);
    });

    // Xây dựng co-occurrence matrix
    // Với mỗi user, đếm tất cả cặp products xuất hiện cùng nhau
    const coOccurrence = {};

    Object.values(userProducts).forEach((productSet) => {
      const products = [...productSet];

      // Chỉ xử lý users có ít nhất 2 products tương tác
      if (products.length < 2) return;

      // Giới hạn max 50 products/user để tránh combinatorial explosion
      const limitedProducts = products.slice(0, 50);

      for (let i = 0; i < limitedProducts.length; i++) {
        for (let j = i + 1; j < limitedProducts.length; j++) {
          // Tạo key duy nhất cho cặp (sort để đảm bảo A_B === B_A)
          const key = [limitedProducts[i], limitedProducts[j]].sort().join("_");
          coOccurrence[key] = (coOccurrence[key] || 0) + 1;
        }
      }
    });

    return coOccurrence;
  }

  /**
   * Lấy hoặc build co-occurrence matrix (cached 30 phút)
   *
   * @param {Model} UserBehaviorModel - Mongoose model cho UserBehavior
   * @returns {Object} Co-occurrence matrix
   */
  async getOrBuildMatrix(UserBehaviorModel) {
    const cached = this.matrixCache.get(this.MATRIX_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const matrix = await this.buildCoOccurrenceMatrix(UserBehaviorModel);
    this.matrixCache.set(this.MATRIX_CACHE_KEY, matrix);
    return matrix;
  }

  /**
   * Tính Collaborative Score cho 1 product
   *
   * Logic:
   * - Với mỗi product user đã tương tác, check co-occurrence count
   * - Dùng log scale (log1p) để giảm ảnh hưởng của outliers
   * - Normalize về 0-1
   *
   * @param {string} productId - ID của product cần tính score
   * @param {string[]} userInteractedIds - Danh sách productIds user đã tương tác
   * @param {Object} coOccurrenceMatrix - Co-occurrence matrix
   * @returns {number} Score từ 0 đến 1
   */
  getCollaborativeScore(productId, userInteractedIds, coOccurrenceMatrix) {
    if (
      !userInteractedIds ||
      userInteractedIds.length === 0 ||
      !coOccurrenceMatrix
    ) {
      return 0;
    }

    let totalScore = 0;
    let matchCount = 0;

    for (const interactedId of userInteractedIds) {
      // Skip nếu so sánh với chính nó
      if (interactedId === productId) continue;

      // Tạo pair key (sorted)
      const key = [productId, interactedId].sort().join("_");
      const coCount = coOccurrenceMatrix[key] || 0;

      if (coCount > 0) {
        // Log scale để tránh 1 cặp có count rất cao áp đảo
        totalScore += Math.log1p(coCount);
        matchCount++;
      }
    }

    if (matchCount === 0) return 0;

    // Normalize: chia cho matchCount * log1p(threshold)
    // threshold = 10 (giả sử 10 users cùng tương tác là rất cao)
    const maxExpectedScore = Math.log1p(10);
    const avgScore = totalScore / matchCount;
    return Math.min(avgScore / maxExpectedScore, 1.0);
  }

  /**
   * Clear co-occurrence matrix cache
   * Gọi khi có purchase mới để force rebuild
   */
  clearMatrixCache() {
    this.matrixCache.del(this.MATRIX_CACHE_KEY);
  }
}
