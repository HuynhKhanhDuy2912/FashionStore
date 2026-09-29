import UserBehavior from "../models/UserBehavior.js";
import { createCrudControllers } from "./base.controller.js";
import {
  trackBehaviorService,
  trackBehaviorBeaconService,
  getBehaviorSummaryService,
} from "../services/userBehavior.service.js";

const baseUserBehaviorController = createCrudControllers(UserBehavior, {
  modelName: "UserBehavior",
  populate: [
    { path: "userId", select: "username email" },
    { path: "productId", select: "name price" },
    { path: "metadata.categoryId", select: "name" }
  ]
});

export const trackBehavior = async (req, res) => {
  try {
    const behavior = await trackBehaviorService(req.user._id, req.body);

    return res.status(201).json({
      success: true,
      message: "Behavior tracked successfully",
      data: behavior
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Beacon tracking — nhận token từ body (sendBeacon không hỗ trợ custom headers)
 * Dùng cho duration tracking khi user rời trang
 */
export const trackBehaviorBeacon = async (req, res) => {
  try {
    const { _token, ...body } = req.body;
    await trackBehaviorBeaconService(_token, body);

    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message
    });
  }
};

export const getBehaviorSummary = async (req, res) => {
  try {
    const summary = await getBehaviorSummaryService(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Behavior summary fetched successfully",
      data: summary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...baseUserBehaviorController,
  trackBehavior,
  trackBehaviorBeacon,
  getBehaviorSummary
};
