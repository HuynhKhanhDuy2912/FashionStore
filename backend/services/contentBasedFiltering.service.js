import { distance } from "ml-distance";

/**
 * Content-Based Filtering Engine
 * Tính toán similarity giữa products và user profile
 */
export class ContentBasedFilteringEngine {
  constructor() {
    this.similarityCache = new Map();
  }

  /**
   * Tính cosine similarity giữa 2 vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Tính Euclidean distance (normalized)
   */
  euclideanSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    const dist = distance.euclidean(vecA, vecB);
    // Convert distance to similarity (0-1 range)
    return 1 / (1 + dist);
  }

  /**
   * Tính similarity score giữa user profile và product
   */
  calculateSimilarity(userVector, productVector, method = "cosine") {
    if (method === "cosine") {
      return this.cosineSimilarity(userVector, productVector);
    } else if (method === "euclidean") {
      return this.euclideanSimilarity(userVector, productVector);
    }
    return 0;
  }

  /**
   * Tính similarity giữa 2 products (for item-to-item recommendation)
   */
  calculateProductSimilarity(productVectorA, productVectorB) {
    return this.cosineSimilarity(productVectorA, productVectorB);
  }

  /**
   * Tìm similar products dựa trên 1 product
   */
  findSimilarProducts(targetProductVector, allProductVectors, topK = 10) {
    const similarities = allProductVectors.map((pv, idx) => ({
      index: idx,
      similarity: this.calculateProductSimilarity(targetProductVector, pv.vector)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Score products dựa trên user profile
   */
  scoreProducts(userVector, products, productVectors) {
    if (!userVector) {
      return products.map((p, idx) => ({
        product: p,
        contentScore: 0,
        index: idx
      }));
    }

    return products.map((product, idx) => {
      const productVector = productVectors[idx];
      const contentScore = this.calculateSimilarity(userVector, productVector);

      return {
        product,
        contentScore,
        index: idx
      };
    });
  }

  /**
   * Hybrid scoring: kết hợp user-based và item-based
   */
  hybridContentScore(userVector, productVector, interactedProductVectors, weights = { user: 0.7, item: 0.3 }) {
    let userBasedScore = 0;
    let itemBasedScore = 0;

    // User-based: similarity với user profile
    if (userVector) {
      userBasedScore = this.calculateSimilarity(userVector, productVector);
    }

    // Item-based: average similarity với products đã tương tác
    if (interactedProductVectors && interactedProductVectors.length > 0) {
      const similarities = interactedProductVectors.map(ipv =>
        this.calculateProductSimilarity(ipv, productVector)
      );
      itemBasedScore = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    }

    return userBasedScore * weights.user + itemBasedScore * weights.item;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.similarityCache.clear();
  }
}

/**
 * Category-based filtering helper
 */
export class CategoryFilter {
  /**
   * Boost products trong categories user quan tâm
   */
  static calculateCategoryScore(product, preferredCategoryIds) {
    if (!preferredCategoryIds || preferredCategoryIds.length === 0) {
      return 0.5; // Neutral score
    }

    const productCategoryId = product.categoryId?.toString();
    if (preferredCategoryIds.includes(productCategoryId)) {
      return 1.0;
    }

    return 0.3;
  }

  /**
   * Extract preferred categories từ behaviors
   */
  static extractPreferredCategories(behaviors, products) {
    const categoryCounts = {};
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    behaviors.forEach(behavior => {
      const productId = behavior.productId?.toString();
      if (!productId || !productMap.has(productId)) return;

      const product = productMap.get(productId);
      const categoryId = product.categoryId?.toString();

      if (categoryId) {
        const weight = behavior.actionType === "purchase" ? 5 :
                      behavior.actionType === "add_to_cart" ? 3 :
                      behavior.actionType === "add_to_wishlist" ? 2 : 1;

        categoryCounts[categoryId] = (categoryCounts[categoryId] || 0) + weight;
      }
    });

    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([catId]) => catId);
  }
}

/**
 * Diversity helper - đảm bảo đa dạng trong recommendations
 */
export class DiversityHelper {
  /**
   * Ensure diversity by category and style
   */
  static ensureDiversity(scoredProducts, maxPerCategory = 3, maxPerStyle = 4) {
    const categoryCount = {};
    const styleCount = {};
    const diverseResults = [];

    // Sort by score first
    const sorted = [...scoredProducts].sort((a, b) => b.finalScore - a.finalScore);

    for (const item of sorted) {
      const categoryId = item.product.categoryId?.toString() || "unknown";
      const style = (Array.isArray(item.product.style) ? item.product.style[0] : item.product.style) || "unknown";

      const catCount = categoryCount[categoryId] || 0;
      const styCount = styleCount[style] || 0;

      // Apply diversity constraints
      if (catCount < maxPerCategory && styCount < maxPerStyle) {
        diverseResults.push(item);
        categoryCount[categoryId] = catCount + 1;
        styleCount[style] = styCount + 1;
      }

      // Stop when we have enough diverse results
      if (diverseResults.length >= scoredProducts.length * 0.8) {
        break;
      }
    }

    // Fill remaining slots with highest scores (if needed)
    if (diverseResults.length < scoredProducts.length) {
      const remaining = sorted.filter(item => !diverseResults.includes(item));
      diverseResults.push(...remaining.slice(0, scoredProducts.length - diverseResults.length));
    }

    return diverseResults;
  }

  /**
   * Re-rank để tăng diversity (MMR - Maximal Marginal Relevance)
   */
  static maximalMarginalRelevance(scoredProducts, lambda = 0.7, topK = 20) {
    if (scoredProducts.length === 0) return [];

    const selected = [];
    const remaining = [...scoredProducts];

    // Chọn item có score cao nhất đầu tiên
    const first = remaining.reduce((max, item) =>
      item.finalScore > max.finalScore ? item : max
    );
    selected.push(first);
    remaining.splice(remaining.indexOf(first), 1);

    // Iteratively chọn items maximize diversity
    while (selected.length < topK && remaining.length > 0) {
      let bestItem = null;
      let bestMMR = -Infinity;

      for (const item of remaining) {
        // Relevance score
        const relevance = item.finalScore;

        // Diversity score: min similarity với items đã chọn
        const similarities = selected.map(sel =>
          this.calculateItemSimilarity(item.product, sel.product)
        );
        const maxSimilarity = Math.max(...similarities);

        // MMR score
        const mmr = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmr > bestMMR) {
          bestMMR = mmr;
          bestItem = item;
        }
      }

      if (bestItem) {
        selected.push(bestItem);
        remaining.splice(remaining.indexOf(bestItem), 1);
      } else {
        break;
      }
    }

    return selected;
  }

  /**
   * Simple similarity giữa 2 products (for diversity calculation)
   */
  static calculateItemSimilarity(productA, productB) {
    let similarity = 0;
    let factors = 0;

    // Same category
    if (productA.categoryId?.toString() === productB.categoryId?.toString()) {
      similarity += 0.4;
    }
    factors++;

    // Same style (check overlap for arrays)
    const stylesA = Array.isArray(productA.style) ? productA.style : [productA.style || "casual"];
    const stylesB = Array.isArray(productB.style) ? productB.style : [productB.style || "casual"];
    if (stylesA.some(s => stylesB.includes(s))) {
      similarity += 0.3;
    }
    factors++;

    // Similar price range (within 30%)
    const maxPrice = Math.max(productA.price || 0, productB.price || 0);
    const priceDiff = maxPrice > 0
      ? Math.abs((productA.price || 0) - (productB.price || 0)) / maxPrice
      : 0;
    if (priceDiff < 0.3) {
      similarity += 0.2;
    }
    factors++;

    // Overlapping occasions
    const occasionOverlap = (productA.occasion || []).filter(o =>
      (productB.occasion || []).includes(o)
    ).length;
    if (occasionOverlap > 0) {
      similarity += 0.1 * Math.min(occasionOverlap, 1);
    }
    factors++;

    return similarity / factors;
  }
}
