import natural from "natural";

const TfIdf = natural.TfIdf;

/**
 * Trích xuất và vector hóa features của sản phẩm
 */
export class ProductFeatureExtractor {
  constructor() {
    this.tfidf = new TfIdf();
    this.styleWeights = {
      minimal: 0,
      streetwear: 1,
      casual: 2,
      elegant: 3,
      sporty: 4,
      vintage: 5,
      smart_casual: 6
    };

    this.seasonWeights = {
      spring: 0,
      summer: 1,
      autumn: 2,
      winter: 3,
      all_season: 4
    };

    this.occasionWeights = {
      casual: 0,
      work: 1,
      party: 2,
      date: 3,
      travel: 4,
      sport: 5,
      formal: 6,
      street: 7
    };
  }

  /**
   * Chuẩn bị TF-IDF từ danh sách products
   */
  buildTfIdfModel(products) {
    this.tfidf = new TfIdf();

    products.forEach(product => {
      const textFeatures = [
        ...(product.tags || []),
        product.material || "",
        product.description || ""
      ].join(" ");

      this.tfidf.addDocument(textFeatures.toLowerCase());
    });
  }

  /**
   * Trích xuất vector đặc trưng cho 1 sản phẩm
   */
  extractFeatures(product, productIndex = 0) {
    const features = {};

    // 1. Categorical features (one-hot encoding)
    features.style = this.styleWeights[product.style] || 2;
    features.gender = product.gender === "male" ? 0 : product.gender === "female" ? 1 : 0.5;

    // 2. Season features (multi-hot encoding - average)
    if (product.season && product.season.length > 0) {
      const seasonValues = product.season.map(s => this.seasonWeights[s] || 0);
      features.season = seasonValues.reduce((a, b) => a + b, 0) / seasonValues.length;
    } else {
      features.season = 4; // all_season default
    }

    // 3. Occasion features (multi-hot encoding - average)
    if (product.occasion && product.occasion.length > 0) {
      const occasionValues = product.occasion.map(o => this.occasionWeights[o] || 0);
      features.occasion = occasionValues.reduce((a, b) => a + b, 0) / occasionValues.length;
    } else {
      features.occasion = 0; // casual default
    }

    // 4. Numerical features (normalized)
    features.priceNormalized = this.normalizePrice(product.price);
    features.discount = (product.discount || 0) / 100;
    features.rating = (product.averageRating || 0) / 5;
    features.popularity = this.normalizePopularity(product.totalReviews || 0);

    // 5. Text features (TF-IDF) - lấy top terms
    const tfidfVector = [];
    if (this.tfidf.documents.length > productIndex) {
      this.tfidf.listTerms(productIndex).slice(0, 10).forEach(item => {
        tfidfVector.push(item.tfidf);
      });
    }

    // Pad hoặc truncate về 10 dimensions
    while (tfidfVector.length < 10) {
      tfidfVector.push(0);
    }
    features.tfidf = tfidfVector.slice(0, 10);

    // 6. Category ID (encoded)
    features.categoryId = product.categoryId ? product.categoryId.toString() : "";

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
   * Chuyển features object thành vector số
   */
  featuresToVector(features) {
    return [
      features.style,
      features.gender,
      features.season,
      features.occasion,
      features.priceNormalized,
      features.discount,
      features.rating,
      features.popularity,
      ...features.tfidf
    ];
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
      view_outfit: 1,
      search: 0.5,
      click: 1.5,
      favorite: 3,
      add_to_cart: 4,
      remove_from_cart: -2,
      add_to_wishlist: 3.5,
      remove_from_wishlist: -1.5,
      purchase: 5
    };
  }

  /**
   * Tính toán user preference vector từ behaviors và products
   */
  buildUserProfile(behaviors, products, featureExtractor) {
    if (!behaviors || behaviors.length === 0) {
      return null;
    }

    // Map productId -> product
    const productMap = new Map();
    products.forEach((p, idx) => {
      productMap.set(p._id.toString(), { product: p, index: idx });
    });

    // Aggregate weighted features
    const weightedVectors = [];
    const totalWeight = { value: 0 };

    behaviors.forEach(behavior => {
      const productId = behavior.productId?.toString();
      if (!productId || !productMap.has(productId)) return;

      const { product, index } = productMap.get(productId);
      const weight = this.actionWeights[behavior.actionType] || 1;

      // Apply recency decay (behaviors are sorted by createdAt desc)
      const daysSinceAction = (Date.now() - new Date(behavior.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.exp(-daysSinceAction / 30); // Decay over 30 days

      const finalWeight = weight * recencyWeight;

      const vector = featureExtractor.getProductVector(product, index);
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
   * Extract style preferences từ behaviors
   */
  extractStylePreferences(behaviors) {
    const styleCounts = {};

    behaviors.forEach(behavior => {
      const style = behavior.metadata?.style;
      if (style) {
        const weight = this.actionWeights[behavior.actionType] || 1;
        styleCounts[style] = (styleCounts[style] || 0) + weight;
      }
    });

    return Object.entries(styleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([style]) => style);
  }

  /**
   * Extract occasion preferences từ behaviors
   */
  extractOccasionPreferences(behaviors, products) {
    const occasionCounts = {};
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    behaviors.forEach(behavior => {
      const productId = behavior.productId?.toString();
      if (!productId || !productMap.has(productId)) return;

      const product = productMap.get(productId);
      const weight = this.actionWeights[behavior.actionType] || 1;

      (product.occasion || []).forEach(occ => {
        occasionCounts[occ] = (occasionCounts[occ] || 0) + weight;
      });
    });

    return Object.entries(occasionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([occ]) => occ);
  }
}
