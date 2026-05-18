import mongoose from "mongoose";
import OrderItem from "../models/OrderItem.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import { createCrudControllers } from "./base.controller.js";

const REVIEWABLE_ORDER_STATUSES = ["completed", "delivered"];

const baseReviewController = createCrudControllers(Review, {
  modelName: "Review",
  populate: [
    { path: "userId", select: "username avatar" },
    { path: "productId", select: "name" }
  ]
});

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const hasPurchasedProduct = async (userId, productId) => {
  const [purchase] = await OrderItem.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId)
      }
    },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order"
      }
    },
    { $unwind: "$order" },
    {
      $match: {
        "order.userId": new mongoose.Types.ObjectId(userId),
        "order.status": { $in: REVIEWABLE_ORDER_STATUSES }
      }
    },
    { $limit: 1 }
  ]);

  return Boolean(purchase);
};

const updateProductRatingSummary = async (productId) => {
  const [summary] = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: "$productId",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  await Product.findByIdAndUpdate(productId, {
    averageRating: summary ? Number(summary.averageRating.toFixed(1)) : 0,
    totalReviews: summary?.totalReviews || 0
  });
};

export const checkReviewEligibility = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm không hợp lệ"
      });
    }

    const product = await Product.findById(productId).select("_id");
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm"
      });
    }

    const existingReview = await Review.findOne({
      userId: req.user._id,
      productId
    });

    if (existingReview) {
      return res.status(200).json({
        success: true,
        message: "Bạn đã đánh giá sản phẩm này rồi",
        data: { eligible: false, reason: "already_reviewed" }
      });
    }

    const eligible = await hasPurchasedProduct(req.user._id, productId);

    return res.status(200).json({
      success: true,
      message: eligible
        ? "Bạn có thể đánh giá sản phẩm này"
        : "Bạn cần mua và hoàn tất đơn hàng có sản phẩm này trước khi đánh giá",
      data: {
        eligible,
        reason: eligible ? "purchased" : "not_purchased"
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const create = async (req, res) => {
  try {
    const { productId, rating, comment = "", imageUrls = [], videoUrls = [] } = req.body;
    const normalizedRating = Number(rating);

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm không hợp lệ"
      });
    }

    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn số sao từ 1 đến 5"
      });
    }

    const product = await Product.findById(productId).select("_id");
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm"
      });
    }

    const existingReview = await Review.findOne({
      userId: req.user._id,
      productId
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này rồi"
      });
    }

    const eligible = await hasPurchasedProduct(req.user._id, productId);
    if (!eligible) {
      return res.status(403).json({
        success: false,
        message: "Bạn cần mua và hoàn tất đơn hàng có sản phẩm này trước khi đánh giá"
      });
    }

    const normalizedImageUrls = Array.isArray(imageUrls)
      ? imageUrls.filter((url) => typeof url === "string" && url.trim())
      : [];
    const normalizedVideoUrls = Array.isArray(videoUrls)
      ? videoUrls.filter((url) => typeof url === "string" && url.trim())
      : [];

    const review = await Review.create({
      userId: req.user._id,
      productId,
      rating: normalizedRating,
      comment,
      imageUrls: normalizedImageUrls,
      videoUrls: normalizedVideoUrls
    });

    await updateProductRatingSummary(productId);

    const createdReview = await Review.findById(review._id)
      .populate("userId", "username avatar")
      .populate("productId", "name");

    return res.status(201).json({
      success: true,
      message: "Đánh giá sản phẩm thành công",
      data: createdReview
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...baseReviewController,
  create,
  checkReviewEligibility
};
