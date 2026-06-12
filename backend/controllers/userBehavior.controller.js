import jwt from "jsonwebtoken";
import User from "../models/User.js";
import UserBehavior from "../models/UserBehavior.js";
import { createCrudControllers } from "./base.controller.js";
import { clearRecommendationCache } from "../services/hybridRecommendation.service.js";

const baseUserBehaviorController = createCrudControllers(UserBehavior, {
  modelName: "UserBehavior",
  populate: [
    { path: "userId", select: "username email" },
    { path: "productId", select: "name price" },
    { path: "metadata.categoryId", select: "name" }
  ]
});

const STRONG_ACTIONS = new Set([
  "purchase", "add_to_cart", "add_to_wishlist",
  "remove_from_cart", "remove_from_wishlist"
]);

const saveTrackedBehavior = async (userId, body) => {
  const { userId: _ignoredUserId, _token, ...behaviorData } = body;

  let savedBehavior;

  if (behaviorData.trackingSessionId) {
    savedBehavior = await UserBehavior.findOneAndUpdate(
      { userId, trackingSessionId: behaviorData.trackingSessionId },
      {
        $set: behaviorData,
        $setOnInsert: { userId }
      },
      {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        upsert: true
      }
    );
  } else {
    savedBehavior = await UserBehavior.create({
      ...behaviorData,
      userId
    });
  }

  if (STRONG_ACTIONS.has(behaviorData.actionType)) {
    clearRecommendationCache(userId);
  }

  return savedBehavior;
};

export const trackBehavior = async (req, res) => {
  try {
    const behavior = await saveTrackedBehavior(req.user._id, req.body);

    const populatedBehavior = await UserBehavior.findById(behavior._id)
      .populate("userId", "username email")
      .populate("productId", "name price style")
      .populate("metadata.categoryId", "name");

    return res.status(201).json({
      success: true,
      message: "Behavior tracked successfully",
      data: populatedBehavior
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

    if (!_token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(_token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Invalid user" });
    }

    await saveTrackedBehavior(user._id, body);

    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getBehaviorSummary = async (req, res) => {
  try {
    const behaviors = await UserBehavior.find({ userId: req.user._id }).sort({
      createdAt: -1
    });

    const summary = behaviors.reduce((accumulator, item) => {
      accumulator[item.actionType] = (accumulator[item.actionType] || 0) + 1;
      return accumulator;
    }, {});

    return res.status(200).json({
      success: true,
      message: "Behavior summary fetched successfully",
      data: {
        totalEvents: behaviors.length,
        actionSummary: summary,
        latestEvents: behaviors.slice(0, 10)
      }
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
