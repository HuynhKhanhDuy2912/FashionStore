import Product from "../models/Product.js";
import UserBehavior from "../models/UserBehavior.js";
import Wishlist from "../models/Wishlist.js";

/**
 * Gợi ý sản phẩm cá nhân hóa dựa trên:
 * 1. Lịch sử hành vi (view, wishlist, add_to_cart)
 * 2. Sở thích style, màu sắc của user
 * 3. Giới tính của user
 * 4. Fallback: sản phẩm phổ biến
 */
export const getPersonalizedRecommendations = async (user, limitParam) => {
  const limit = Math.min(parseInt(limitParam) || 12, 50);

  try {
    // Lấy hành vi gần đây
    const behaviors = await UserBehavior.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Lấy wishlist
    const wishlistItems = await Wishlist.find({ userId: user._id }).lean();
    const wishlistProductIds = wishlistItems.map((w) => w.productId.toString());

    // Lấy productId đã tương tác
    const interactedIds = [...new Set(behaviors.map((b) => b.productId?.toString()).filter(Boolean))];

    // Xây dựng query filter
    const query = { isActive: true };

    // Lọc theo giới tính
    if (user.gender) {
      query.$or = [{ gender: user.gender }, { gender: "" }];
    }

    // Tính điểm ưu tiên style từ hành vi
    const styleCounts = {};
    for (const b of behaviors) {
      // metadata.style giờ là [String]; vẫn hỗ trợ dữ liệu cũ dạng chuỗi
      const metaStyle = b.metadata?.style;
      const styles = Array.isArray(metaStyle)
        ? metaStyle
        : (typeof metaStyle === "string" && metaStyle.trim() ? [metaStyle] : []);
      styles.forEach((style) => {
        styleCounts[style] = (styleCounts[style] || 0) + 1;
      });
    }

    // Style ưu tiên: từ hành vi hoặc profile
    const preferredStyles = [
      ...Object.entries(styleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([style]) => style),
      ...(user.favoriteStyles || [])
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    let products = [];

    // Ưu tiên 1: sản phẩm phù hợp style + chưa tương tác
    if (preferredStyles.length > 0) {
      products = await Product.find({
        ...query,
        style: { $in: preferredStyles },
        _id: { $nin: interactedIds }
      })
        .sort({ averageRating: -1 })
        .limit(limit)
        .lean();
    }

    // Ưu tiên 2: sản phẩm đã trong wishlist (luôn xuất hiện nếu còn chỗ)
    if (wishlistProductIds.length > 0 && products.length < limit) {
      const wishlistProducts = await Product.find({
        ...query,
        _id: { $in: wishlistProductIds, $nin: products.map((p) => p._id.toString()) }
      })
        .limit(limit - products.length)
        .lean();
      products = [...products, ...wishlistProducts];
    }

    // Fallback: sản phẩm phổ biến
    if (products.length < limit) {
      const fallback = await Product.find({
        ...query,
        _id: { $nin: products.map((p) => p._id.toString()) }
      })
        .sort({ averageRating: -1, totalReviews: -1 })
        .limit(limit - products.length)
        .lean();
      products = [...products, ...fallback];
    }

    return products.slice(0, limit);
  } catch (error) {
    // Fallback hoàn toàn
    return Product.find({ isActive: true })
      .sort({ averageRating: -1 })
      .limit(limit)
      .lean();
  }
};
