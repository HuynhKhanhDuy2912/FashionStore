import Review from "../models/Review.js";
import { createCrudControllers } from "./base.controller.js";
import {
  checkReviewEligibilityService,
  createReviewService,
  listReviewsService,
  adminListReviewsService,
  hideReviewService,
  showReviewService,
} from "../services/review.service.js";

const baseReviewController = createCrudControllers(Review, {
  modelName: "Review",
  populate: [
    { path: "userId", select: "username fullname avatar" },
    { path: "productId", select: "name" }
  ]
});

export const checkReviewEligibility = async (req, res) => {
  try {
    const result = await checkReviewEligibilityService(req.user._id, req.params.productId);

    return res.status(200).json({
      success: true,
      message: result.eligible
        ? "Bạn có thể đánh giá sản phẩm này"
        : "Bạn cần mua và hoàn tất đơn hàng có sản phẩm này trước khi đánh giá",
      data: result
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

const create = async (req, res) => {
  try {
    const review = await createReviewService(req.user._id, req.body);

    return res.status(201).json({
      success: true,
      message: "Đánh giá sản phẩm thành công",
      data: review
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message
    });
  }
};

const list = async (req, res) => {
  try {
    const result = await listReviewsService(req.query);

    return res.status(200).json({
      success: true,
      message: "Review list fetched successfully",
      data: result.data,
      pagination: result.pagination
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
    const result = await adminListReviewsService(req.query);

    return res.status(200).json({
      success: true,
      message: "Admin review list fetched successfully",
      data: result.data,
      pagination: result.pagination
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
    const review = await hideReviewService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đã ẩn đánh giá",
      data: review
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

const showReview = async (req, res) => {
  try {
    const review = await showReviewService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đã hiển thị đánh giá",
      data: review
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
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
