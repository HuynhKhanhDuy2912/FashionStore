import express from "express";
import authRoutes from "./auth.routes.js";
import categoryRoutes from "./category.routes.js";
import collectionRoutes from "./collection.routes.js";
import userRoutes from "./user.routes.js";
import productRoutes from "./product.routes.js";
import productVariantRoutes from "./productVariant.routes.js";
import productImageRoutes from "./productImage.routes.js";
import recommendationRoutes from "./recommendation.routes.js";
import searchHistoryRoutes from "./searchHistory.routes.js";
import userBehaviorRoutes from "./userBehavior.routes.js";
import wishlistRoutes from "./wishlist.routes.js";
import cartRoutes from "./cart.routes.js";
import cartItemRoutes from "./cartItem.routes.js";
import orderRoutes from "./order.routes.js";
import orderItemRoutes from "./orderItem.routes.js";
import paymentRoutes from "./payment.routes.js";
import reviewRoutes from "./review.routes.js";
import uploadRoutes from "./upload.route.js";
import addressRoutes from "./address.routes.js";
import bannerRoutes from "./banner.routes.js";
import notificationRoutes from "./notification.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import ghnRoutes from "./ghn.routes.js";
import sizeGuideRoutes from "./sizeGuide.routes.js";
import contactRoutes from "./contact.routes.js";
import productQuestionRoutes from "./productQuestion.routes.js";
import couponRoutes from "./coupon.routes.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "API is running"
  });
});

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/collections", collectionRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/product-variants", productVariantRoutes);
router.use("/product-images", productImageRoutes);
router.use("/recommendations", recommendationRoutes);
router.use("/search-history", searchHistoryRoutes);
router.use("/user-behaviors", userBehaviorRoutes);
router.use("/wishlists", wishlistRoutes);
router.use("/carts", cartRoutes);
router.use("/cart-items", cartItemRoutes);
router.use("/orders", orderRoutes);
router.use("/order-items", orderItemRoutes);
router.use("/payment", paymentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/upload", uploadRoutes);
router.use("/addresses", addressRoutes);
router.use("/banners", bannerRoutes);
router.use("/notifications", notificationRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/ghn", ghnRoutes);
router.use("/size-guides", sizeGuideRoutes);
router.use("/contact", contactRoutes);
router.use("/product-questions", productQuestionRoutes);
router.use("/coupons", couponRoutes);

export default router;
