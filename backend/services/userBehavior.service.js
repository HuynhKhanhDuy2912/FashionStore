import jwt from "jsonwebtoken";
import User from "../models/User.js";
import UserBehavior from "../models/UserBehavior.js";
import { clearRecommendationCache } from "./hybridRecommendation.service.js";

// Mọi hành vi đều clear cache user đó → gợi ý cập nhật gần real-time
// Cache TTL = 60s + clear on every behavior = gợi ý phản ánh hành vi mới nhất
// Không gây quá tải vì cache per-user (chỉ rebuild khi user ĐÓ có hành vi mới)
const INTENT_ACTIONS = new Set([
  "search", "filter", "view_product", "click",
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

  // Clear cache cho mọi hành vi có intent → gợi ý cập nhật real-time
  if (INTENT_ACTIONS.has(behaviorData.actionType)) {
    clearRecommendationCache(userId);
  }

  return savedBehavior;
};

export const trackBehaviorService = async (userId, body) => {
  const behavior = await saveTrackedBehavior(userId, body);

  const populatedBehavior = await UserBehavior.findById(behavior._id)
    .populate("userId", "username email")
    .populate("productId", "name price style")
    .populate("metadata.categoryId", "name");

  return populatedBehavior;
};

/**
 * Beacon tracking — nhận token từ body (sendBeacon không hỗ trợ custom headers)
 * Dùng cho duration tracking khi user rời trang
 */
export const trackBehaviorBeaconService = async (token, body) => {
  if (!token) {
    throw Object.assign(new Error("Missing token"), { statusCode: 401 });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId);

  if (!user || !user.isActive) {
    throw Object.assign(new Error("Invalid user"), { statusCode: 401 });
  }

  await saveTrackedBehavior(user._id, body);
};

export const getBehaviorSummaryService = async (userId) => {
  const behaviors = await UserBehavior.find({ userId }).sort({
    createdAt: -1
  });

  const summary = behaviors.reduce((accumulator, item) => {
    accumulator[item.actionType] = (accumulator[item.actionType] || 0) + 1;
    return accumulator;
  }, {});

  return {
    totalEvents: behaviors.length,
    actionSummary: summary,
    latestEvents: behaviors.slice(0, 10)
  };
};
