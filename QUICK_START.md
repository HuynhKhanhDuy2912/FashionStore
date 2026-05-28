# Quick Start - Hệ thống Gợi ý Sản phẩm

## Kiểm tra Backend đang chạy

Backend đang chạy tại: **http://localhost:5000**

### Test API endpoints:

```bash
# 1. Test trending products (không cần login)
curl http://localhost:5000/api/recommendations/trending?limit=4

# 2. Test similar products (không cần login)
curl http://localhost:5000/api/recommendations/similar/PRODUCT_ID?limit=4

# 3. Test personalized (cần token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/recommendations/me?limit=8
```

---

## Frontend đang chạy

Frontend đang chạy tại: **http://localhost:3001**

### Các trang để test:

1. **HomePage** - http://localhost:3001
   - Scroll xuống xem section "Gợi ý dành riêng cho bạn" (nếu đã login)
   - Xem section "Đang thịnh hành"

2. **ProductDetailPage** - http://localhost:3001/products/PRODUCT_SLUG
   - Scroll xuống xem "Sản phẩm tương tự" (AI-powered)

3. **RecommendationsPage** - http://localhost:3001/recommendations
   - Trang chuyên dụng với UI cao cấp
   - Cần đăng nhập

---

## Hướng dẫn Test đầy đủ

### Bước 1: Đăng nhập

1. Mở http://localhost:3001/login
2. Đăng nhập với tài khoản có sẵn

### Bước 2: Tạo behaviors (để hệ thống học)

1. Xem một vài sản phẩm (click vào ProductCard)
2. Thêm vào wishlist (click icon trái tim)
3. Thêm vào giỏ hàng
4. Mua hàng (nếu có thể)

### Bước 3: Xem gợi ý

1. Quay lại HomePage - xem section "Gợi ý dành riêng cho bạn"
2. Vào /recommendations - xem trang đầy đủ
3. Click "Làm mới gợi ý" để update

### Bước 4: Test Similar Products

1. Vào bất kỳ ProductDetailPage nào
2. Scroll xuống phần "Sản phẩm tương tự"
3. Sẽ thấy 8 sản phẩm tương tự được AI gợi ý

---

## Các tính năng chính

### 1. Personalized Recommendations (Cá nhân hóa)

- Dựa trên hành vi user
- Content-based filtering
- Rule-based scoring
- Cache 15 phút
- Diversity filter

**Khi nào hiển thị:**

- User đã đăng nhập
- User có ít nhất 1-2 behaviors

### 2. Similar Products (Sản phẩm tương tự)

- Item-to-item recommendation
- Cosine similarity
- Boost same category/style
- Không cần login

**Khi nào hiển thị:**

- Trên ProductDetailPage
- Luôn hiển thị (fallback to related products)

### 3. Trending Products (Đang thịnh hành)

- Based on last 7 days
- Weighted by action type
- Public access
- Cache 15 phút

**Khi nào hiển thị:**

- HomePage (public)
- RecommendationsPage (bottom section)

---

## Troubleshooting

### Không thấy gợi ý cá nhân hóa

**Nguyên nhân:**

- Chưa đăng nhập
- User chưa có behaviors

**Giải pháp:**

1. Đăng nhập
2. Xem/thích/mua một vài sản phẩm
3. Refresh trang

### Similar products trống

**Nguyên nhân:**

- Product không có variants
- Database chưa có đủ products

**Giải pháp:**

- Kiểm tra database có products
- Seed data nếu cần

### API trả về lỗi 500

**Nguyên nhân:**

- MongoDB chưa connect
- Thiếu dependencies

**Giải pháp:**

```bash
# Check MongoDB
mongosh

# Install dependencies
cd backend
npm install natural ml-distance node-cache
```

---

## Monitoring

### Check logs

```bash
# Backend logs
tail -f backend/logs/app.log

# Frontend console
# Mở DevTools > Console
```

### Performance metrics

- Response time: < 500ms (with cache)
- Cache hit rate: > 80%
- Recommendation accuracy: Monitor CTR

---

## UI Components

### RecommendationSection Props

```jsx
<RecommendationSection
  type="personalized" // "personalized" | "similar" | "trending"
  productId={productId} // Required for type="similar"
  token={token} // Required for type="personalized"
  limit={8} // Number of products
  onAddToWishlist={handler}
  onAddToCart={handler}
  wishlistProductIds={set}
/>
```

### Customization

```jsx
// Custom title & description
<RecommendationSection
  type="trending"
  title="Hot Trends Tuần Này"
  description="Sản phẩm được yêu thích nhất"
  eyebrow="Xu hướng"
  limit={12}
/>
```

---

## Next Steps

### 1. Tối ưu weights (A/B Testing)

```javascript
// File: backend/services/hybridRecommendation.service.js
// Line: ~20

this.weights = {
  content: 0.4, // Thử: 0.35, 0.45, 0.50
  rule: 0.3, // Thử: 0.25, 0.35
  behavior: 0.2, // Thử: 0.15, 0.25
  popularity: 0.1, // Thử: 0.05, 0.15
};
```

### 2. Thêm filters

```javascript
// Example: Filter by price range
const recommendations = await getPersonalizedRecommendations(user, {
  limit: 12,
  filters: {
    minPrice: 100000,
    maxPrice: 500000,
    categoryIds: ["cat1", "cat2"],
  },
});
```

### 3. Track metrics

```javascript
// Track click-through rate
await apiRequest("/user-behaviors", {
  method: "POST",
  token,
  body: {
    actionType: "click",
    productId: product._id,
    source: "recommendation",
    metadata: {
      position: index,
      recommendationType: "personalized",
    },
  },
});
```

---

## Quick Links

- **Backend API**: http://localhost:5000/api/recommendations
- **Frontend**: http://localhost:3001
- **Documentation**: [RECOMMENDATION_SYSTEM.md](./RECOMMENDATION_SYSTEM.md)
- **GitHub Issues**: Report bugs tại repository

---

## Features Checklist

- [x] Content-Based Filtering
- [x] Rule-Based Recommendation
- [x] Hybrid Scoring
- [x] Personalized Recommendations
- [x] Similar Products
- [x] Trending Products
- [x] Caching Layer
- [x] Diversity Filter
- [x] Professional UI
- [x] Responsive Design
- [x] Loading States
- [x] Error Handling
- [x] Toast Notifications

**Status**: Production Ready!

---

**Last Updated**: 2026-05-25
**Version**: 1.0.0
