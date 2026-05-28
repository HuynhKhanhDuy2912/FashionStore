# Hệ thống Gợi ý Sản phẩm Cá nhân hóa - FashionStore

## Tổng quan

Hệ thống gợi ý sản phẩm sử dụng **Hybrid Recommendation Engine** kết hợp:

- **Content-Based Filtering** (40%)
- **Rule-Based Recommendation** (30%)
- **Behavior Analysis** (20%)
- **Popularity Scoring** (10%)

---

## Kiến trúc Backend

### 1. Feature Extraction Service

**File:** `backend/services/featureExtraction.service.js`

**Chức năng:**

- Vector hóa đặc trưng sản phẩm (18 dimensions)
- TF-IDF cho text features (tags, material, description)
- Xây dựng user profile từ behaviors

**Features được trích xuất:**

```javascript
{
  style: 0-6,           // minimal, streetwear, casual, elegant, sporty, vintage, smart_casual
  gender: 0-1,          // male=0, female=1, unisex=0.5
  season: 0-4,          // spring, summer, autumn, winter, all_season
  occasion: 0-7,        // casual, work, party, date, travel, sport, formal, street
  priceNormalized: 0-1, // log scale
  discount: 0-1,        // 0-100%
  rating: 0-1,          // 0-5 stars
  popularity: 0-1,      // based on reviews
  tfidf: [10 dims]      // text features
}
```

**User Profile Builder:**

- Action weights: purchase=5, add_to_cart=4, favorite=3, view=1
- Recency decay: exp(-days/30)
- Weighted average của product vectors

---

### 2. Content-Based Filtering Engine

**File:** `backend/services/contentBasedFiltering.service.js`

**Algorithms:**

- **Cosine Similarity**: Tính độ tương đồng giữa vectors
- **Euclidean Distance**: Alternative similarity metric
- **Category Filtering**: Boost products trong categories yêu thích
- **Diversity Helper**: Đảm bảo đa dạng (MMR algorithm)

**Diversity Constraints:**

- Max 3 products per category
- Max 4 products per style
- Maximal Marginal Relevance (MMR) với λ=0.7

---

### 3. Rule-Based Recommendation Engine

**File:** `backend/services/ruleBasedRecommendation.service.js`

**10 Business Rules:**

| Rule        | Weight | Description                             |
| ----------- | ------ | --------------------------------------- |
| Recency     | 15%    | Boost sản phẩm xem trong 7-30 ngày      |
| Popularity  | 15%    | Bayesian average rating                 |
| Seasonal    | 10%    | Match với mùa hiện tại                  |
| Discount    | 8%     | Ưu tiên giảm giá cao                    |
| Occasion    | 12%    | Match với dịp user quan tâm             |
| Style       | 15%    | Match với style preferences             |
| Price Range | 8%     | Trong khoảng 0.5x-1.5x average purchase |
| Stock       | 7%     | Penalize out-of-stock                   |
| Freshness   | 5%     | Boost sản phẩm mới (< 7 ngày)           |
| Wishlist    | 5%     | Boost items trong wishlist              |

**Hard Filters:**

- Gender matching
- Price range
- Category filtering
- Active status

---

### 4. Hybrid Recommendation Engine

**File:** `backend/services/hybridRecommendation.service.js`

**Final Scoring Formula:**

```
Final Score =
  0.40 × Content_Similarity_Score +
  0.30 × Rule_Based_Score +
  0.20 × Behavior_Weight_Score +
  0.10 × Popularity_Score +
  0.05 × Category_Score
```

**Caching:**

- Cache duration: 15 minutes (900s)
- Cache keys: `rec_{userId}_{limit}_{filters}`
- Auto-invalidation on user actions

**3 Main Functions:**

1. **getPersonalizedRecommendations(user, options)**
   - Personalized cho logged-in users
   - Exclude interacted products
   - Apply diversity

2. **getSimilarProducts(productId, options)**
   - Item-to-item recommendation
   - Boost same category/style
   - No login required

3. **getTrendingProducts(options)**
   - Based on last 7 days activity
   - Weighted by action type
   - Public access

---

## Frontend Components

### 1. RecommendationSection Component

**File:** `frontend/src/components/RecommendationSection.jsx`

**Props:**

```javascript
{
  type: "personalized" | "similar" | "trending",
  productId: string,        // Required for type="similar"
  token: string,            // Required for type="personalized"
  limit: number,            // Default: 8
  title: string,            // Optional custom title
  description: string,      // Optional custom description
  eyebrow: string,          // Optional custom eyebrow
  onAddToWishlist: function,
  onAddToCart: function,
  wishlistProductIds: Set,
  className: string
}
```

**Features:**

- Loading skeleton
- Error handling
- Empty state
- AI badge indicator
- Responsive grid

---

### 2. Tích hợp vào Pages

#### HomePage

**File:** `frontend/src/pages/HomePage.jsx`

**Sections:**

- Personalized Recommendations (logged-in users only)
- Trending Products (public)

#### ProductDetailPage

**File:** `frontend/src/pages/ProductDetailPage.jsx`

**Sections:**

- Similar Products (AI-powered)
- Related Products (fallback)

#### RecommendationsPage

**File:** `frontend/src/pages/RecommendationsPage.jsx`

**Features:**

- Hero section với AI branding
- Info cards giải thích thuật toán
- Refresh button
- Trending section
- Toast notifications

---

## 🔌 API Endpoints

### 1. Personalized Recommendations

```http
GET /api/recommendations/me?limit=12
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "message": "Personalized recommendations fetched successfully",
  "data": [
    {
      "_id": "...",
      "name": "...",
      "price": 299000,
      "discount": 20,
      "style": "casual",
      "images": ["..."],
      ...
    }
  ]
}
```

### 2. Similar Products

```http
GET /api/recommendations/similar/:productId?limit=8
```

**Response:** Same format as above

### 3. Trending Products

```http
GET /api/recommendations/trending?limit=12
```

**Response:** Same format as above

### 4. Clear Cache

```http
DELETE /api/recommendations/cache
Authorization: Bearer {token}
```

---

## Data Flow

```
User Action (view/click/purchase)
    ↓
UserBehavior Model (tracked)
    ↓
Feature Extraction
    ↓
User Profile Vector (18 dims)
    ↓
Content-Based Filtering (cosine similarity)
    ↓
Rule-Based Scoring (10 rules)
    ↓
Hybrid Scoring (weighted combination)
    ↓
Diversity Filter (MMR)
    ↓
Cache (15 min)
    ↓
API Response
```

---

## Cách tối ưu độ chính xác

### 1. Thu thập data

- Track user behaviors: view, click, add_to_cart, purchase
- Lưu metadata: duration, source, position
- Update user preferences

### 2. A/B Testing

Thử nghiệm các weights khác nhau:

```javascript
// Current weights
{
  content: 0.40,
  rule: 0.30,
  behavior: 0.20,
  popularity: 0.10
}

// Alternative A
{
  content: 0.50,
  rule: 0.25,
  behavior: 0.15,
  popularity: 0.10
}
```

### 3. Monitor metrics

- Click-through rate (CTR)
- Conversion rate
- Average order value
- User engagement time

### 4. Tune parameters

- Recency decay rate (hiện tại: 30 days)
- Diversity constraints (hiện tại: 3 per category, 4 per style)
- Cache duration (hiện tại: 15 minutes)

---

## Deployment Checklist

- [x] Install dependencies: `natural`, `ml-distance`, `node-cache`
- [x] Create 4 service files
- [x] Update recommendation controller
- [x] Update recommendation routes
- [x] Create RecommendationSection component
- [x] Integrate into HomePage
- [x] Integrate into ProductDetailPage
- [x] Upgrade RecommendationsPage
- [x] Test all endpoints
- [ ] Monitor performance
- [ ] Collect user feedback
- [ ] A/B test weights

---

## Future Enhancements

### Phase 2: Collaborative Filtering

- User-to-user similarity
- Matrix factorization
- Neural collaborative filtering

### Phase 3: Deep Learning

- Image similarity (CNN)
- Sequence models (RNN/LSTM)
- Transformer-based recommendations

### Phase 4: Real-time

- Streaming data pipeline
- Online learning
- Real-time personalization

---

## 🐛 Troubleshooting

### Backend không start

```bash
# Check if files exist
ls backend/services/

# Should see:
# - featureExtraction.service.js
# - contentBasedFiltering.service.js
# - ruleBasedRecommendation.service.js
# - hybridRecommendation.service.js
```

### Recommendations trống

- User chưa có đủ behaviors (cần ít nhất 1-2 interactions)
- Products không có variants
- Cache cũ (clear cache)

### Performance chậm

- Tăng cache duration
- Giảm limit
- Index MongoDB: userId, productId, createdAt

---

## Support

- Backend: http://localhost:5000
- Frontend: http://localhost:3001
- API Docs: http://localhost:5000/api/recommendations

**Created by:** AI-powered Recommendation System
**Date:** 2026-05-25
**Version:** 1.0.0
