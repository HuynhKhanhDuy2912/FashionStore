import mongoose from "mongoose";
import OrderItem from "../models/OrderItem.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import { createNotificationForAdmins } from "./notification.service.js";

const REVIEWABLE_ORDER_STATUSES = ["completed", "delivered"];

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

export const checkReviewEligibilityService = async (userId, productId) => {
  if (!isValidObjectId(productId)) {
    throw Object.assign(new Error("Sản phẩm không hợp lệ"), { statusCode: 400 });
  }

  const product = await Product.findById(productId).select("_id");
  if (!product) {
    throw Object.assign(new Error("Không tìm thấy sản phẩm"), { statusCode: 404 });
  }

  const eligibleOrderId = await getEligibleOrderIdForReview(userId, productId);

  return {
    eligible: Boolean(eligibleOrderId),
    reason: eligibleOrderId ? "purchased" : "not_purchased",
    orderId: eligibleOrderId
  };
};

export const createReviewService = async (userId, reviewData) => {
  const { productId, orderId, rating, comment = "", imageUrls = [], videoUrls = [] } = reviewData;
  const normalizedRating = Number(rating);

  if (!isValidObjectId(productId)) {
    throw Object.assign(new Error("Sản phẩm không hợp lệ"), { statusCode: 400 });
  }

  if (!isValidObjectId(orderId)) {
    throw Object.assign(new Error("Đơn hàng không hợp lệ"), { statusCode: 400 });
  }

  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw Object.assign(new Error("Vui lòng chọn số sao từ 1 đến 5"), { statusCode: 400 });
  }

  const product = await Product.findById(productId).select("_id");
  if (!product) {
    throw Object.assign(new Error("Không tìm thấy sản phẩm"), { statusCode: 404 });
  }

  const existingReview = await Review.findOne({
    userId,
    productId,
    orderId
  });

  if (existingReview) {
    throw Object.assign(
      new Error("Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi"),
      { statusCode: 409 }
    );
  }

  const eligible = await canReviewProductInOrder(userId, productId, orderId);
  if (!eligible) {
    throw Object.assign(
      new Error("Đơn hàng này không hợp lệ để đánh giá sản phẩm"),
      { statusCode: 403 }
    );
  }

  const normalizedImageUrls = Array.isArray(imageUrls)
    ? imageUrls.filter((url) => typeof url === "string" && url.trim())
    : [];
  const normalizedVideoUrls = Array.isArray(videoUrls)
    ? videoUrls.filter((url) => typeof url === "string" && url.trim())
    : [];

  const review = await Review.create({
    userId,
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

  return createdReview;
};

export const listReviewsService = async (queryParams) => {
  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Math.max(Number(queryParams.limit) || 10, 1), 10000);
  const sort = queryParams.sort || { createdAt: -1 };
  const filters = { isHidden: false };

  if (queryParams.productId) {
    filters.productId = queryParams.productId;
  }
  if (queryParams.userId) {
    filters.userId = queryParams.userId;
  }
  if (queryParams.rating) {
    filters.rating = Number(queryParams.rating);
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

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const adminListReviewsService = async (queryParams) => {
  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Math.max(Number(queryParams.limit) || 10, 1), 10000);
  const sort = queryParams.sort || { createdAt: -1 };
  const filters = {};

  if (queryParams.productId) {
    filters.productId = queryParams.productId;
  }
  if (queryParams.userId) {
    filters.userId = queryParams.userId;
  }
  if (queryParams.rating) {
    filters.rating = Number(queryParams.rating);
  }
  if (queryParams.isHidden !== undefined) {
    filters.isHidden = queryParams.isHidden === "true";
  }
  if (queryParams.search) {
    filters.comment = { $regex: queryParams.search, $options: "i" };
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

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const hideReviewService = async (reviewId) => {
  const review = await Review.findById(reviewId);

  if (!review) {
    throw Object.assign(new Error("Không tìm thấy đánh giá"), { statusCode: 404 });
  }

  review.isHidden = true;
  await review.save();

  await updateProductRatingSummary(review.productId);

  return review;
};

export const showReviewService = async (reviewId) => {
  const review = await Review.findById(reviewId);

  if (!review) {
    throw Object.assign(new Error("Không tìm thấy đánh giá"), { statusCode: 404 });
  }

  review.isHidden = false;
  await review.save();

  await updateProductRatingSummary(review.productId);

  return review;
};
