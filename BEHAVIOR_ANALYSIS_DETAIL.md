# 🧠 Chi tiết Phân tích Hành vi Người dùng - Recommendation System

## 📊 1. Dữ liệu Hành vi được Thu thập

### UserBehavior Model
**File:** `backend/models/UserBehavior.js`

```javascript
{
  userId: ObjectId,           // User thực hiện hành động
  productId: ObjectId,        // Sản phẩm được tương tác
  outfitId: ObjectId,         // Outfit được tương tác (optional)
  
  actionType: String,         // Loại hành động
  // Các giá trị: 
  // - "view_product"
  // - "view_outfit"
  // - "search"
  // - "click"
  // - "favorite"
  // - "add_to_cart"
  // - "remove_from_cart"
  // - "add_to_wishlist"
  // - "remove_from_wishlist"
  // - "purchase"
  
  source: String,             // Nguồn hành động
  // Các giá trị:
  // - "home"
  // - "search"
  // - "category"
  // - "recommendation"
  // - "wishlist"
  // - "cart"
  // - "product_page"
  // - "outfit"
  
  duration: Number,           // Thời gian xem (seconds)
  searchKeyword: String,      // Từ khóa tìm kiếm (nếu có)
  
  metadata: {
    categoryId: ObjectId,     // Category của sản phẩm
    style: String,            // Style: minimal, casual, elegant...
    color: String,            // Màu sắc
    position: Number,         // Vị trí trong danh sách
    deviceType: String        // desktop, mobile, tablet
  },
  
  sessionId: String,          // Session ID
  createdAt: Date             // Timestamp
}
```

---

## 🎯 2. Trọng số Hành động (Action Weights)

**File:** `backend/services/featureExtraction.service.js` (Line 172-184)

### Bảng trọng số:

| Action Type | Weight | Ý nghĩa | Ví dụ |
|-------------|--------|---------|-------|
| **purchase** | 5.0 | Mua hàng - Signal mạnh nhất | User đã thanh toán thành công |
| **add_to_cart** | 4.0 | Thêm giỏ hàng - Ý định mua cao | Click "Thêm vào giỏ" |
| **add_to_wishlist** | 3.5 | Thêm wishlist - Quan tâm lâu dài | Click icon trái tim |
| **favorite** | 3.0 | Yêu thích - Thích sản phẩm | Like/Save product |
| **click** | 1.5 | Click xem chi tiết - Quan tâm | Click vào ProductCard |
| **view_product** | 1.0 | Xem sản phẩm - Quan tâm nhẹ | Scroll qua sản phẩm |
| **view_outfit** | 1.0 | Xem outfit | Xem bộ sưu tập |
| **search** | 0.5 | Tìm kiếm - Ý định chưa rõ | Gõ từ khóa search |
| **remove_from_cart** | -2.0 | Bỏ khỏi giỏ - Signal tiêu cực | Xóa khỏi cart |
| **remove_from_wishlist** | -1.5 | Bỏ wishlist - Không còn thích | Bỏ yêu thích |

### Ví dụ tính điểm:
```javascript
User A:
- View product X: +1.0
- Add to cart X: +4.0
- Purchase X: +5.0
→ Total weight for product X: 10.0

User B:
- View product Y: +1.0
- Add to wishlist Y: +3.5
- Remove from wishlist Y: -1.5
→ Total weight for product Y: 3.0
```

---

## ⏰ 3. Recency Decay (Độ mới của hành vi)

**File:** `backend/services/featureExtraction.service.js` (Line 207-209)

### Công thức:
```javascript
recencyWeight = Math.exp(-daysSinceAction / 30)
```

### Bảng decay theo thời gian:

| Thời gian | Recency Weight | Ý nghĩa |
|-----------|----------------|---------|
| 0-1 ngày | 0.97 - 1.00 | Rất mới, quan trọng nhất |
| 3 ngày | 0.90 | Còn mới |
| 7 ngày | 0.79 | Khá mới |
| 14 ngày | 0.62 | Trung bình |
| 30 ngày | 0.37 | Cũ |
| 60 ngày | 0.14 | Rất cũ |
| 90 ngày | 0.05 | Gần như không còn ảnh hưởng |

### Ví dụ:
```javascript
// User mua sản phẩm A cách đây 3 ngày
actionWeight = 5.0 (purchase)
recencyWeight = 0.90
finalWeight = 5.0 × 0.90 = 4.5

// User xem sản phẩm B cách đây 60 ngày
actionWeight = 1.0 (view)
recencyWeight = 0.14
finalWeight = 1.0 × 0.14 = 0.14
```

---

## 🧮 4. Xây dựng User Profile Vector

**File:** `backend/services/featureExtraction.service.js` (Line 186-243)

### Quy trình:

#### Bước 1: Lấy behaviors gần đây
```javascript
const behaviors = await UserBehavior.find({ userId: user._id })
  .sort({ createdAt: -1 })
  .limit(100)  // Chỉ lấy 100 hành động gần nhất
  .lean();
```

#### Bước 2: Tính weighted vectors
```javascript
behaviors.forEach(behavior => {
  // 1. Lấy product vector (18 dimensions)
  const productVector = featureExtractor.getProductVector(product, index);
  
  // 2. Tính action weight
  const actionWeight = actionWeights[behavior.actionType]; // 0.5 - 5.0
  
  // 3. Tính recency weight
  const daysSince = (now - behavior.createdAt) / (1000 * 60 * 60 * 24);
  const recencyWeight = Math.exp(-daysSince / 30);
  
  // 4. Final weight
  const finalWeight = actionWeight × recencyWeight;
  
  // 5. Weighted vector
  weightedVectors.push({
    vector: productVector,
    weight: finalWeight
  });
});
```

#### Bước 3: Tính weighted average
```javascript
// User vector = weighted average của tất cả product vectors
userVector = Σ(productVector × weight) / Σ(weight)
```

### Ví dụ cụ thể:

**User có 3 behaviors:**

1. **Mua áo thun casual màu đen (3 ngày trước)**
   ```
   Product Vector: [2, 0, 4, 0, 0.3, 0, 0.8, 0.5, ...]
   Action Weight: 5.0 (purchase)
   Recency Weight: 0.90
   Final Weight: 4.5
   ```

2. **Thêm quần jean vào wishlist (7 ngày trước)**
   ```
   Product Vector: [2, 0, 4, 0, 0.4, 0.2, 0.7, 0.3, ...]
   Action Weight: 3.5 (add_to_wishlist)
   Recency Weight: 0.79
   Final Weight: 2.77
   ```

3. **Xem áo khoác elegant (30 ngày trước)**
   ```
   Product Vector: [3, 0, 2, 1, 0.6, 0.3, 0.9, 0.6, ...]
   Action Weight: 1.0 (view)
   Recency Weight: 0.37
   Final Weight: 0.37
   ```

**User Profile Vector:**
```javascript
userVector = (
  [2, 0, 4, 0, 0.3, ...] × 4.5 +
  [2, 0, 4, 0, 0.4, ...] × 2.77 +
  [3, 0, 2, 1, 0.6, ...] × 0.37
) / (4.5 + 2.77 + 0.37)

= [2.1, 0, 3.8, 0.05, 0.35, ...] / 7.64
= [0.27, 0, 0.50, 0.007, 0.046, ...]
```

---

## 🎨 5. Trích xuất Preferences từ Behaviors

### 5.1 Style Preferences
**File:** `backend/services/featureExtraction.service.js` (Line 245-258)

```javascript
// Đếm số lần tương tác với mỗi style
styleCounts = {
  casual: 15 (3 purchase + 5 view + 7 add_to_cart),
  elegant: 8 (2 purchase + 6 view),
  minimal: 5 (1 purchase + 4 view),
  streetwear: 3 (3 view)
}

// Lấy top 3 styles
preferredStyles = ["casual", "elegant", "minimal"]
```

### 5.2 Occasion Preferences
**File:** `backend/services/featureExtraction.service.js` (Line 260-280)

```javascript
// Đếm occasions từ products đã tương tác
occasionCounts = {
  casual: 20,
  work: 12,
  party: 8,
  date: 5
}

// Lấy top 3 occasions
preferredOccasions = ["casual", "work", "party"]
```

### 5.3 Category Preferences
**File:** `backend/services/contentBasedFiltering.service.js` (Line 169-192)

```javascript
// Đếm categories với weighted actions
categoryCounts = {
  "áo thun": 25 (5 purchase × 5 + 0 others),
  "quần jean": 12 (3 add_to_cart × 4),
  "áo khoác": 8 (8 view × 1)
}

// Lấy top 3 categories
preferredCategories = ["áo thun", "quần jean", "áo khoác"]
```

---

## 🔍 6. Content-Based Similarity Scoring

**File:** `backend/services/contentBasedFiltering.service.js` (Line 20-42)

### Cosine Similarity:
```javascript
similarity = (userVector · productVector) / (||userVector|| × ||productVector||)
```

### Ví dụ:
```javascript
User Vector: [0.27, 0, 0.50, 0.007, 0.046, 0.2, 0.8, 0.5, ...]
Product A:   [0.30, 0, 0.48, 0.010, 0.050, 0.3, 0.7, 0.6, ...]

// Dot product
dotProduct = 0.27×0.30 + 0×0 + 0.50×0.48 + ... = 0.85

// Norms
||userVector|| = 1.2
||productVector|| = 1.3

// Cosine similarity
similarity = 0.85 / (1.2 × 1.3) = 0.54 (54% tương đồng)
```

---

## 📈 7. Behavior Weight Score

**File:** `backend/services/hybridRecommendation.service.js` (Line 186-217)

### Logic:
```javascript
// Kiểm tra sản phẩm có tương tự với products user đã tương tác không

behaviorWeight = 0;
matchCount = 0;

behaviors.forEach(behavior => {
  const behaviorProduct = behavior.productId;
  
  // Check similarity
  if (
    product.categoryId === behaviorProduct.categoryId ||  // Cùng category
    product.style === behaviorProduct.style ||            // Cùng style
    hasOccasionOverlap(product, behaviorProduct)          // Cùng occasion
  ) {
    behaviorWeight += actionWeights[behavior.actionType];
    matchCount++;
  }
});

// Normalize
behaviorWeight = Math.min(behaviorWeight / (matchCount × 5), 1.0);
```

### Ví dụ:
```javascript
Product X (áo thun casual):
- User đã mua 2 áo thun casual khác: 2 × 5 = 10
- User đã xem 3 áo casual khác: 3 × 1 = 3
- Total: 13, matchCount: 5
- behaviorWeight = min(13 / (5 × 5), 1.0) = min(0.52, 1.0) = 0.52

Product Y (áo khoác elegant):
- User chưa tương tác với áo khoác elegant
- behaviorWeight = 0.3 (default)
```

---

## 🎯 8. Final Hybrid Score

**File:** `backend/services/hybridRecommendation.service.js` (Line 140-152)

### Công thức tổng hợp:
```javascript
finalScore = 
  contentScore × 0.40 +        // Content-based similarity
  ruleScore × 0.30 +           // Rule-based score (10 rules)
  behaviorWeight × 0.20 +      // Behavior weight
  popularityScore × 0.10 +     // Popularity
  categoryScore × 0.05         // Category boost
```

### Ví dụ tính điểm cho Product A:

```javascript
// 1. Content Score (cosine similarity)
contentScore = 0.54  // 54% tương đồng với user profile

// 2. Rule Score (weighted average of 10 rules)
ruleScore = (
  recency: 0.8 × 0.15 +
  popularity: 0.7 × 0.15 +
  seasonal: 1.0 × 0.10 +
  discount: 0.6 × 0.08 +
  occasion: 0.7 × 0.12 +
  style: 1.0 × 0.15 +
  priceRange: 0.8 × 0.08 +
  stock: 1.0 × 0.07 +
  freshness: 0.4 × 0.05 +
  wishlist: 0.5 × 0.05
) = 0.78

// 3. Behavior Weight
behaviorWeight = 0.52  // User đã tương tác với similar products

// 4. Popularity Score
popularityScore = 0.65  // Rating 4.5/5, 50 reviews

// 5. Category Score
categoryScore = 1.0  // Trong top 3 categories user thích

// Final Score
finalScore = 
  0.54 × 0.40 +  // 0.216
  0.78 × 0.30 +  // 0.234
  0.52 × 0.20 +  // 0.104
  0.65 × 0.10 +  // 0.065
  1.0 × 0.05     // 0.050
= 0.669 (66.9%)
```

---

## 📊 9. Ví dụ Thực tế Đầy đủ

### Scenario: User "Minh" mua sắm thời trang

#### Lịch sử hành vi (30 ngày gần đây):

| Ngày | Action | Product | Style | Category | Weight |
|------|--------|---------|-------|----------|--------|
| Hôm nay | purchase | Áo thun trắng | casual | Áo thun | 5.0 × 1.0 = 5.0 |
| 2 ngày trước | add_to_cart | Quần jean xanh | casual | Quần | 4.0 × 0.93 = 3.72 |
| 5 ngày trước | add_to_wishlist | Áo khoác đen | minimal | Áo khoác | 3.5 × 0.85 = 2.98 |
| 7 ngày trước | view | Giày sneaker | sporty | Giày | 1.0 × 0.79 = 0.79 |
| 10 ngày trước | click | Áo sơ mi trắng | smart_casual | Áo sơ mi | 1.5 × 0.72 = 1.08 |
| 15 ngày trước | view | Túi xách | elegant | Phụ kiện | 1.0 × 0.61 = 0.61 |
| 20 ngày trước | search | "áo thun nam" | - | - | 0.5 × 0.51 = 0.26 |

**Total Weight: 14.44**

#### User Profile được tạo:

```javascript
{
  preferredStyles: ["casual", "minimal", "smart_casual"],
  preferredOccasions: ["casual", "work", "street"],
  preferredCategories: ["Áo thun", "Quần", "Áo khoác"],
  averagePurchasePrice: 350000,
  userVector: [2.1, 0, 3.8, 0.5, 0.35, 0.1, 0.75, 0.45, ...]
}
```

#### Gợi ý sản phẩm:

**Product 1: Áo thun đen casual**
```javascript
contentScore: 0.82      // Rất giống với user profile
ruleScore: 0.75         // Seasonal match, good stock, discount 20%
behaviorWeight: 0.65    // User đã mua áo thun casual
popularityScore: 0.70   // Rating 4.2/5
categoryScore: 1.0      // Top category

finalScore = 0.82×0.4 + 0.75×0.3 + 0.65×0.2 + 0.70×0.1 + 1.0×0.05
          = 0.328 + 0.225 + 0.130 + 0.070 + 0.050
          = 0.803 (80.3%) ✅ TOP RECOMMENDATION
```

**Product 2: Áo khoác minimal**
```javascript
contentScore: 0.68      // Khá giống
ruleScore: 0.65         // Good match
behaviorWeight: 0.45    // User có trong wishlist
popularityScore: 0.80   // Rating 4.5/5
categoryScore: 1.0      // Top category

finalScore = 0.68×0.4 + 0.65×0.3 + 0.45×0.2 + 0.80×0.1 + 1.0×0.05
          = 0.687 (68.7%) ✅ GOOD RECOMMENDATION
```

**Product 3: Váy elegant**
```javascript
contentScore: 0.25      // Không giống user profile
ruleScore: 0.70         // Good product
behaviorWeight: 0.30    // User chưa tương tác với váy
popularityScore: 0.85   // Rating 4.7/5
categoryScore: 0.3      // Không trong top categories

finalScore = 0.25×0.4 + 0.70×0.3 + 0.30×0.2 + 0.85×0.1 + 0.3×0.05
          = 0.461 (46.1%) ❌ LOW SCORE - Không gợi ý
```

---

## 🔄 10. Cập nhật Real-time

### Khi user thực hiện hành động mới:

```javascript
// 1. Track behavior
await UserBehavior.create({
  userId: user._id,
  productId: product._id,
  actionType: "add_to_cart",
  source: "product_page",
  metadata: {
    style: product.style,
    categoryId: product.categoryId
  }
});

// 2. Clear cache để force refresh
clearRecommendationCache(user._id);

// 3. Lần gọi API tiếp theo sẽ tính toán lại với behavior mới
```

---

## 📈 11. Metrics để Đánh giá

### Click-Through Rate (CTR)
```javascript
CTR = (Số lần click vào recommended products) / (Số lần hiển thị recommendations)
```

### Conversion Rate
```javascript
ConversionRate = (Số lần mua recommended products) / (Số lần click)
```

### Diversity Score
```javascript
DiversityScore = (Số unique categories trong recommendations) / (Total recommendations)
```

---

## 🎯 Tóm tắt

Hệ thống gợi ý dựa trên **5 yếu tố chính**:

1. **Action Weights** (0.5 - 5.0) - Mức độ quan trọng của hành động
2. **Recency Decay** (exp(-days/30)) - Độ mới của hành động
3. **Content Similarity** (cosine) - Độ tương đồng features
4. **Behavior Patterns** - Patterns từ lịch sử
5. **Business Rules** - 10 rules thông minh

**Kết quả:** Gợi ý chính xác, cá nhân hóa, đa dạng và phù hợp với từng user! 🎯
