import mongoose from "mongoose";
import OrderItem from "../models/OrderItem.js";
import Product from "../models/Product.js";
import { createNotificationForAdmins } from "../services/notification.service.js";
import Review from "../models/Review.js";
import { createCrudControllers } from "./base.controller.js";

const REVIEWABLE_ORDER_STATUSES = ["completed", "delivered"];

const baseReviewController = createCrudControllers(Review, {
  modelName: "Review",
  populate: [
    { path: "userId", select: "username fullname avatar" },
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

const getEligibleOrderIdForReview = async (userId, productId) => {
  const purchasedItems = await OrderItem.aggregate([
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
    { $sort: { "order.createdAt": -1 } },
    {
      $project: {
        orderId: "$orderId"
      }
    }
  ]);

  if (purchasedItems.length === 0) return null;

  const purchasedOrderIds = [...new Set(purchasedItems.map((item) => item.orderId.toString()))];
  const reviewedRecords = await Review.find({
    userId,
    productId,
    orderId: { $in: purchasedOrderIds }
  }).select("orderId");

  const reviewedOrderIds = new Set(reviewedRecords.map((item) => item.orderId.toString()));
  const firstUnreviewedOrder = purchasedOrderIds.find((orderId) => !reviewedOrderIds.has(orderId));

  return firstUnreviewedOrder || null;
};

const canReviewProductInOrder = async (userId, productId, orderId) => {
  const [purchase] = await OrderItem.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        orderId: new mongoose.Types.ObjectId(orderId)
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
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        isHidden: false
      }
    },
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

    const eligibleOrderId = await getEligibleOrderIdForReview(req.user._id, productId);

    return res.status(200).json({
      success: true,
      message: eligibleOrderId
        ? "Bạn có thể đánh giá sản phẩm này"
        : "Bạn cần mua và hoàn tất đơn hàng có sản phẩm này trước khi đánh giá",
      data: {
        eligible: Boolean(eligibleOrderId),
        reason: eligibleOrderId ? "purchased" : "not_purchased",
        orderId: eligibleOrderId
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
    const { productId, orderId, rating, comment = "", imageUrls = [], videoUrls = [] } = req.body;
    const normalizedRating = Number(rating);

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm không hợp lệ"
      });
    }

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng không hợp lệ"
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
      productId,
      orderId
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi"
      });
    }

    const eligible = await canReviewProductInOrder(req.user._id, productId, orderId);
    if (!eligible) {
      return res.status(403).json({
        success: false,
        message: "Đơn hàng này không hợp lệ để đánh giá sản phẩm"
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
      orderId,
      rating: normalizedRating,
      comment,
      imageUrls: normalizedImageUrls,
      videoUrls: normalizedVideoUrls
    });

    await updateProductRatingSummary(productId);

    const createdReview = await Review.findById(review._id)
      .populate("userId", "username fullname avatar")
      .populate("productId", "name");

    await createNotificationForAdmins("review", {
      reviewId: createdReview._id,
      productId: createdReview.productId?._id,
      productName: createdReview.productId?.name || "Sản phẩm",
      reviewRating: createdReview.rating,
      userName: createdReview.userId?.fullname || createdReview.userId?.username || "Người dùng"
    });

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

const list = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 10000);
    const sort = req.query.sort || { createdAt: -1 };
    const filters = { isHidden: false };

    if (req.query.productId) {
      filters.productId = req.query.productId;
    }
    if (req.query.userId) {
      filters.userId = req.query.userId;
    }
    if (req.query.rating) {
      filters.rating = Number(req.query.rating);
    }

    const query = Review.find(filters)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "username fullname avatar")
      .populate("productId", "name");

    const [items, total] = await Promise.all([
      query,
      Review.countDocuments(filters)
    ]);

    return res.status(200).json({
      success: true,
      message: "Review list fetched successfully",
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const adminList = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 10000);
    const sort = req.query.sort || { createdAt: -1 };
    const filters = {};

    if (req.query.productId) {
      filters.productId = req.query.productId;
    }
    if (req.query.userId) {
      filters.userId = req.query.userId;
    }
    if (req.query.rating) {
      filters.rating = Number(req.query.rating);
    }
    if (req.query.isHidden !== undefined) {
      filters.isHidden = req.query.isHidden === "true";
    }
    if (req.query.search) {
      filters.comment = { $regex: req.query.search, $options: "i" };
    }

    const query = Review.find(filters)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "username fullname avatar")
      .populate("productId", "name images");

    const [items, total] = await Promise.all([
      query,
      Review.countDocuments(filters)
    ]);

    return res.status(200).json({
      success: true,
      message: "Admin review list fetched successfully",
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const hideReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá"
      });
    }

    review.isHidden = true;
    await review.save();

    await updateProductRatingSummary(review.productId);

    return res.status(200).json({
      success: true,
      message: "Đã ẩn đánh giá",
      data: review
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const showReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá"
      });
    }

    review.isHidden = false;
    await review.save();

    await updateProductRatingSummary(review.productId);

    return res.status(200).json({
      success: true,
      message: "Đã hiển thị đánh giá",
      data: review
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...baseReviewController,
  create,
  checkReviewEligibility,
  list,
  adminList,
  hideReview,
  showReview
};
