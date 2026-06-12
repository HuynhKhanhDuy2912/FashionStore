import natural from "natural";

const TfIdf = natural.TfIdf;

/**
 * Trích xuất và vector hóa features của sản phẩm
 */
export class ProductFeatureExtractor {
  constructor() {
    this.tfidf = new TfIdf();

    /**
     * Semantic 2D Embeddings — thay thế ordinal encoding
     *
     * Ordinal encoding (cũ): minimal=0, streetwear=1, casual=2, ...
     *   → Sai: casual(2) "gần" streetwear(1) hơn smart_casual(6)
     *
     * 2D Embeddings (mới): mỗi style có 2 chiều [formality, trendiness]
     *   → Đúng: casual gần smart_casual, sporty gần streetwear
     *
     * Giá trị 0.0 → 1.0 (đã normalize sẵn cho cosine similarity)
     */

    // Style: [formality (0=rất casual → 1=rất formal), trendiness (0=classic → 1=trendy)]
    this.styleEmbeddings = {
      casual:       [0.1, 0.3],   // rất casual, hơi classic
      minimal:      [0.3, 0.4],   // hơi casual, trung tính
      streetwear:   [0.15, 0.9],  // casual, rất trendy
      sporty:       [0.1, 0.7],   // casual, khá trendy
      smart_casual: [0.55, 0.5],  // hơi formal, trung tính
      elegant:      [0.85, 0.4],  // rất formal, hơi classic
      vintage:      [0.5, 0.1],   // trung tính, rất classic
    };

    // Season: [temperature (0=lạnh → 1=nóng), versatility (0=specific → 1=versatile)]
    this.seasonEmbeddings = {
      winter:     [0.0, 0.2],   // rất lạnh, specific
      autumn:     [0.3, 0.3],   // hơi lạnh, hơi specific
      spring:     [0.6, 0.4],   // hơi nóng, trung tính
      summer:     [1.0, 0.2],   // rất nóng, specific
      all_season: [0.5, 1.0],   // trung tính, rất versatile
    };

    // Occasion: [formality (0=casual → 1=formal), energy (0=calm → 1=active)]
    this.occasionEmbeddings = {
      casual:  [0.1, 0.3],   // rất casual, calm
      street:  [0.1, 0.6],   // casual, hơi active
      sport:   [0.05, 1.0],  // rất casual, rất active
      travel:  [0.2, 0.7],   // casual, khá active
      date:    [0.5, 0.5],   // trung tính
      work:    [0.7, 0.3],   // khá formal, calm
      party:   [0.6, 0.9],   // hơi formal, rất active
      formal:  [1.0, 0.2],   // rất formal, calm
    };
  }

  /**
   * Chuẩn bị TF-IDF từ danh sách products
   * Tạo productIdToIndex map để đảm bảo TF-IDF index ổn định
   */
  buildTfIdfModel(products) {
    this.tfidf = new TfIdf();
    this.productIdToIndex = new Map();

    products.forEach((product, index) => {
      const textFeatures = [
        product.material || "",
        product.description || "",
      ].join(" ");

      this.tfidf.addDocument(textFeatures.toLowerCase());
      this.productIdToIndex.set(product._id.toString(), index);
    });
  }

  /**
   * Trích xuất vector đặc trưng cho 1 sản phẩm
   * v2.1: Dùng 2D semantic embeddings thay ordinal encoding
   * Vector: [style×2, gender, season×2, occasion×2, price, discount, rating, popularity, tfidf×10]
   * Tổng: 21 dimensions (tăng từ 18)
   */
  extractFeatures(product, productIndex = 0) {
    const features = {};
    const defaultStyleEmb = [0.1, 0.3]; // casual default
    const defaultSeasonEmb = [0.5, 1.0]; // all_season default
    const defaultOccasionEmb = [0.1, 0.3]; // casual default

    // 1. Style features (2D semantic embedding)
    const styleArr = Array.isArray(product.style) ? product.style : [product.style || "casual"];
    const styleEmbeddings = styleArr.map(s => this.styleEmbeddings[s] || defaultStyleEmb);
    features.style = this._averageEmbeddings(styleEmbeddings, defaultStyleEmb);

    // Gender (binary)
    features.gender =
      product.gender === "male" ? 0 : product.gender === "female" ? 1 : 0.5;

    // 2. Season features (2D semantic embedding)
    if (product.season && product.season.length > 0) {
      const seasonEmbs = product.season.map(s => this.seasonEmbeddings[s] || defaultSeasonEmb);
      features.season = this._averageEmbeddings(seasonEmbs, defaultSeasonEmb);
    } else {
      features.season = [...defaultSeasonEmb]; // all_season
    }

    // 3. Occasion features (2D semantic embedding)
    if (product.occasion && product.occasion.length > 0) {
      const occasionEmbs = product.occasion.map(o => this.occasionEmbeddings[o] || defaultOccasionEmb);
      features.occasion = this._averageEmbeddings(occasionEmbs, defaultOccasionEmb);
    } else {
      features.occasion = [...defaultOccasionEmb]; // casual
    }

    // 4. Numerical features (normalized)
    features.priceNormalized = this.normalizePrice(product.price);
    features.discount = (product.discount || 0) / 100;
    features.rating = (product.averageRating || 0) / 5;
    features.popularity = this.normalizePopularity(product.totalReviews || 0);

    // 5. Text features (TF-IDF) - lấy top terms
    // Ưu tiên dùng productId map (ổn định), fallback về productIndex
    const tfidfVector = [];
    const resolvedIndex = this.productIdToIndex?.get(product._id?.toString()) ?? productIndex ?? 0;
    if (this.tfidf.documents.length > resolvedIndex) {
      this.tfidf
        .listTerms(resolvedIndex)
        .slice(0, 10)
        .forEach((item) => {
          tfidfVector.push(item.tfidf);
        });
    }

    // Pad hoặc truncate về 10 dimensions
    while (tfidfVector.length < 10) {
      tfidfVector.push(0);
    }
    features.tfidf = tfidfVector.slice(0, 10);

    // 6. Category ID (encoded)
    features.categoryId = product.categoryId
      ? product.categoryId.toString()
      : "";

    return features;
  }

  /**
   * Normalize giá (log scale)
   */
  normalizePrice(price) {
    if (price <= 0) return 0;
    return Math.log10(price + 1) / 7; // Giả sử max ~10M = log10(10^7)
  }

  /**
   * Normalize popularity
   */
  normalizePopularity(totalReviews) {
    return Math.min(totalReviews / 100, 1); // Cap at 100 reviews = 1.0
  }

  /**
   * Tính trung bình của nhiều embedding vectors
   * @param {number[][]} embeddings - Mảng các embeddings 2D
   * @param {number[]} defaultEmb - Giá trị mặc định nếu mảng rỗng
   * @returns {number[]} Averaged embedding
   */
  _averageEmbeddings(embeddings, defaultEmb) {
    if (!embeddings || embeddings.length === 0) return [...defaultEmb];
    const dims = defaultEmb.length;
    const result = new Array(dims).fill(0);
    embeddings.forEach(emb => {
      for (let i = 0; i < dims; i++) {
        result[i] += emb[i];
      }
    });
    for (let i = 0; i < dims; i++) {
      result[i] /= embeddings.length;
    }
    return result;
  }

  /**
   * Chuyển features object thành vector số
   * v2.1: style, season, occasion giờ là mảng 2D → spread vào vector
   * Vector: [style×2, gender, season×2, occasion×2, price, discount, rating, popularity, tfidf×10] = 21 dims
   */
  featuresToVector(features) {
    return [
      ...features.style,         // 2 dims (formality, trendiness)
      features.gender,           // 1 dim
      ...features.season,        // 2 dims (temperature, versatility)
      ...features.occasion,      // 2 dims (formality, energy)
      features.priceNormalized,  // 1 dim
      features.discount,         // 1 dim
      features.rating,           // 1 dim
      features.popularity,       // 1 dim
      ...features.tfidf,         // 10 dims
    ];                           // Total: 21 dims
  }

  /**
   * Extract và return vector cho product
   */
  getProductVector(product, productIndex = 0) {
    const features = this.extractFeatures(product, productIndex);
    return this.featuresToVector(features);
  }
}

/**
 * Xây dựng user preference profile từ behaviors
 */
export class UserProfileBuilder {
  constructor() {
    this.actionWeights = {
      view_product: 1,
      search: 0.5,
      click: 1.5,
      add_to_cart: 4,
      remove_from_cart: -2,
      add_to_wishlist: 3.5,
      remove_from_wishlist: -1.5,
      purchase: 5,
    };

    // Source multiplier: click từ search có intent rõ ràng hơn click từ home
    this.sourceMultipliers = {
      search: 1.3,          // User chủ động tìm kiếm → intent mạnh nhất
      recommendation: 1.2,  // Click từ gợi ý → tin tưởng hệ thống
      category: 1.1,        // Browsing có chủ đích
      product_page: 1.0,    // Trung tính
      wishlist: 1.0,        // Trung tính
      cart: 1.0,            // Trung tính
      home: 0.9,            // Casual browsing
      other: 0.9,           // Không rõ nguồn
    };

    // Mapping từ keywords phổ biến → style/occasion
    this.keywordStyleMap = {
      minimal: "minimal",
      "tối giản": "minimal",
      streetwear: "streetwear",
      "đường phố": "streetwear",
      casual: "casual",
      "thường ngày": "casual",
      elegant: "elegant",
      "sang trọng": "elegant",
      "thanh lịch": "elegant",
      sporty: "sporty",
      "thể thao": "sporty",
      vintage: "vintage",
      "cổ điển": "vintage",
      "smart casual": "smart_casual",
      "công sở": "smart_casual",
    };

    this.keywordOccasionMap = {
      "đi làm": "work",
      "công sở": "work",
      office: "work",
      "dạ hội": "party",
      "tiệc": "party",
      party: "party",
      "hẹn hò": "date",
      date: "date",
      "du lịch": "travel",
      travel: "travel",
      "thể thao": "sport",
      sport: "sport",
      "trang trọng": "formal",
      formal: "formal",
      "dạo phố": "street",
      street: "street",
    };
  }

  /**
   * Tính toán user preference vector từ behaviors và products
   *
   * v2.1: Tách positive/negative behaviors
   * - Positive behaviors → xây dựng user vector (user thích gì)
   * - Negative behaviors → xây dựng anti-vector → giảm nhẹ ảnh hưởng
   *   (tránh user vector bị kéo về vùng giá trị âm vô nghĩa)
   */
  buildUserProfile(behaviors, products, featureExtractor) {
    if (!behaviors || behaviors.length === 0) {
      return null;
    }

    // Tách positive và negative behaviors
    const positiveBehaviors = behaviors.filter(b => {
      const w = this.actionWeights[b.actionType];
      return w === undefined || w > 0;
    });
    const negativeBehaviors = behaviors.filter(b => {
      const w = this.actionWeights[b.actionType];
      return w !== undefined && w < 0;
    });

    // Build user vector chỉ từ positive behaviors
    const userVector = this._buildVectorFromBehaviors(
      positiveBehaviors, products, featureExtractor
    );

    // Build anti-vector từ negative behaviors (dùng trọng số dương)
    const antiVector = this._buildVectorFromBehaviors(
      negativeBehaviors, products, featureExtractor, true
    );

    if (!userVector) return null;

    // Nếu có anti-vector, giảm nhẹ chiều nào user không thích
    if (antiVector) {
      const antiInfluence = 0.2; // negative behaviors ảnh hưởng 20%
      for (let i = 0; i < userVector.length; i++) {
        userVector[i] = userVector[i] * (1 - antiInfluence) +
          (userVector[i] - antiVector[i]) * antiInfluence;
      }
    }

    return userVector;
  }

  /**
   * Helper: build weighted average vector từ danh sách behaviors
   *
   * @param {Array} behaviors - Danh sách behaviors
   * @param {Array} products - Danh sách products
   * @param {ProductFeatureExtractor} featureExtractor - Feature extractor instance
   * @param {boolean} useAbsoluteWeight - Dùng |weight| thay vì weight gốc
   * @returns {number[]|null} Weighted average vector
   */
  _buildVectorFromBehaviors(behaviors, products, featureExtractor, useAbsoluteWeight = false) {
    if (!behaviors || behaviors.length === 0) return null;

    // Map productId -> product
    const productMap = new Map();
    products.forEach((p, idx) => {
      productMap.set(p._id.toString(), { product: p, index: idx });
    });

    // Aggregate weighted features
    const weightedVectors = [];
    const totalWeight = { value: 0 };

    behaviors.forEach((behavior) => {
      const productId = behavior.productId?.toString();
      if (!productId || !productMap.has(productId)) return;

      const { product } = productMap.get(productId);
      let weight = this.actionWeights[behavior.actionType] || 1;
      if (useAbsoluteWeight) weight = Math.abs(weight);

      // Apply recency decay
      const daysSinceAction =
        (Date.now() - new Date(behavior.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      const recencyWeight = Math.exp(-daysSinceAction / 30);

      // Duration boost + Source multiplier
      const durationBoost = this.calculateDurationBoost(behavior.duration);
      const sourceMultiplier = this.getSourceMultiplier(behavior.source);

      const finalWeight = weight * recencyWeight * durationBoost * sourceMultiplier;

      const vector = featureExtractor.getProductVector(product);
      weightedVectors.push({ vector, weight: finalWeight });
      totalWeight.value += Math.abs(finalWeight);
    });

    if (weightedVectors.length === 0 || totalWeight.value === 0) {
      return null;
    }

    // Tính weighted average vector
    const vectorLength = weightedVectors[0].vector.length;
    const userVector = new Array(vectorLength).fill(0);

    weightedVectors.forEach(({ vector, weight }) => {
      for (let i = 0; i < vectorLength; i++) {
        userVector[i] += vector[i] * weight;
      }
    });

    // Normalize
    for (let i = 0; i < vectorLength; i++) {
      userVector[i] /= totalWeight.value;
    }

    return userVector;
  }

  /**
   * Temporal Profile: phân tách sở thích ngắn hạn vs dài hạn
   *
   * - Short-term (7 ngày): nhu cầu hiện tại (occasion, search intent, recent views)
   * - Long-term (>7 ngày): sở thích ổn định (style, price range, categories)
   * - Blend: 60% short-term + 40% long-term → ưu tiên nhu cầu hiện tại
   *   nhưng vẫn giữ "cá tính" dài hạn
   *
   * @param {Array} behaviors - Tất cả behaviors (sorted by createdAt desc)
   * @param {Array} products - Danh sách products
   * @param {ProductFeatureExtractor} featureExtractor - Feature extractor instance
   * @returns {number[]|null} Blended user vector
   */
  buildTemporalProfile(behaviors, products, featureExtractor) {
    if (!behaviors || behaviors.length === 0) return null;

    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const shortTermBehaviors = behaviors.filter(b =>
      (now - new Date(b.createdAt).getTime()) <= SEVEN_DAYS
    );
    const longTermBehaviors = behaviors.filter(b =>
      (now - new Date(b.createdAt).getTime()) > SEVEN_DAYS
    );

    const shortTermVector = this.buildUserProfile(shortTermBehaviors, products, featureExtractor);
    const longTermVector = this.buildUserProfile(longTermBehaviors, products, featureExtractor);

    // Nếu chỉ có 1 trong 2, trả về cái có
    if (!shortTermVector && !longTermVector) return null;
    if (!shortTermVector) return longTermVector;
    if (!longTermVector) return shortTermVector;

    // Blend: 60% short-term (nhu cầu hiện tại) + 40% long-term (cá tính ổn định)
    const shortWeight = 0.6;
    const longWeight = 0.4;

    return shortTermVector.map((v, i) =>
      v * shortWeight + longTermVector[i] * longWeight
    );
  }

  /**
   * Extract style preferences từ behaviors
   * Fallback lấy style từ product data khi metadata.style rỗng
   */
  extractStylePreferences(behaviors, products = []) {
    const styleCounts = {};
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    behaviors.forEach((behavior) => {
      let styles = [];

      // Ưu tiên metadata.style (giờ là [String]; vẫn hỗ trợ dữ liệu cũ dạng chuỗi)
      const metaStyle = behavior.metadata?.style;
      if (Array.isArray(metaStyle) && metaStyle.length > 0) {
        styles = metaStyle;
      } else if (typeof metaStyle === "string" && metaStyle.trim()) {
        styles = [metaStyle];
      } else {
        // Fallback: lấy style từ product data
        const product = productMap.get(behavior.productId?.toString());
        if (product) {
          styles = Array.isArray(product.style)
            ? product.style
            : [product.style].filter(Boolean);
        }
      }

      styles.forEach(style => {
        const weight = this.actionWeights[behavior.actionType] || 1;
        styleCounts[style] = (styleCounts[style] || 0) + weight;
      });
    });

    return Object.entries(styleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([style]) => style);
  }

  /**
   * Extract occasion preferences từ behaviors
   * Kết hợp 2 nguồn:
   * 1. behavior.metadata.occasion — intent trực tiếp (bộ lọc, từ khóa) → trọng số cao hơn
   * 2. product.occasion — occasion của sản phẩm đã tương tác → fallback
   */
  extractOccasionPreferences(behaviors, products) {
    const occasionCounts = {};
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    behaviors.forEach((behavior) => {
      const weight = this.actionWeights[behavior.actionType] || 1;

      // Nguồn 1: metadata.occasion (intent trực tiếp từ filter/search)
      // Giờ là [String]; vẫn hỗ trợ dữ liệu cũ dạng chuỗi. Trọng số 1.5x vì intent rõ ràng.
      const metaOccasion = behavior.metadata?.occasion;
      const metaOccasions = Array.isArray(metaOccasion)
        ? metaOccasion
        : (typeof metaOccasion === "string" && metaOccasion.trim() ? [metaOccasion] : []);
      metaOccasions.forEach((occ) => {
        occasionCounts[occ] = (occasionCounts[occ] || 0) + weight * 1.5;
      });

      // Nguồn 2: product data (occasion của sản phẩm đã tương tác)
      const productId = behavior.productId?.toString();
      if (productId && productMap.has(productId)) {
        const product = productMap.get(productId);
        (product.occasion || []).forEach((occ) => {
          occasionCounts[occ] = (occasionCounts[occ] || 0) + weight;
        });
      }
    });

    return Object.entries(occasionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([occ]) => occ);
  }

  /**
   * Duration Boost: user xem sản phẩm lâu hơn → quan tâm nhiều hơn
   *
   * - 0 hoặc undefined: 1.0 (không ảnh hưởng, giữ backward compatible)
   * - < 5 giây: 0.7 (lướt qua nhanh, ít quan tâm)
   * - 5-30 giây: 1.0 (bình thường)
   * - 30-120 giây: 1.3 (xem kỹ, khá quan tâm)
   * - > 120 giây: 1.5 (rất quan tâm, đọc reviews/so sánh)
   *
   * @param {number} duration - Thời gian xem sản phẩm (giây)
   * @returns {number} Boost multiplier (0.7 - 1.5)
   */
  calculateDurationBoost(duration) {
    if (!duration || duration <= 0) return 1.0;

    if (duration < 5) return 0.7;
    if (duration <= 30) return 1.0;
    if (duration <= 120) return 1.3;
    return 1.5;
  }

  /**
   * Source Multiplier: hành động từ nguồn có intent cao → trọng số cao hơn
   *
   * Ví dụ: click từ search (user chủ động tìm kiếm) quan trọng hơn
   *        click từ home (casual browsing)
   *
   * @param {string} source - Nguồn hành động (home, search, category...)
   * @returns {number} Multiplier (0.9 - 1.3)
   */
  getSourceMultiplier(source) {
    return this.sourceMultipliers[source] || 0.9;
  }

  /**
   * Extract search intents từ behaviors có searchKeyword
   *
   * Logic:
   * 1. Lọc behaviors có actionType === 'search' và searchKeyword không rỗng
   * 2. Lowercase và matching với keyword maps
   * 3. Return styles và occasions được tìm thấy
   *
   * @param {Array} behaviors - Danh sách behaviors
   * @returns {{ styles: string[], occasions: string[], keywords: string[] }}
   */
  extractSearchIntents(behaviors) {
    const styles = new Set();
    const occasions = new Set();
    const keywords = [];

    behaviors.forEach((behavior) => {
      if (
        behavior.actionType !== "search" ||
        !behavior.searchKeyword ||
        behavior.searchKeyword.trim() === ""
      ) {
        return;
      }

      const keyword = behavior.searchKeyword.toLowerCase().trim();
      keywords.push(keyword);

      // Match với style keywords
      for (const [key, style] of Object.entries(this.keywordStyleMap)) {
        if (keyword.includes(key)) {
          styles.add(style);
        }
      }

      // Match với occasion keywords
      for (const [key, occasion] of Object.entries(this.keywordOccasionMap)) {
        if (keyword.includes(key)) {
          occasions.add(occasion);
        }
      }
    });

    return {
      styles: [...styles],
      occasions: [...occasions],
      keywords
    };
  }
}
