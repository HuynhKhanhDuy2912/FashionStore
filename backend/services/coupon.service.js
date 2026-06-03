import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";
import Order from "../models/Order.js";

/**
 * Validate a coupon code for a specific user and order subtotal.
 * Returns the coupon document if valid, throws an error otherwise.
 */
export const validateCoupon = async (code, userId, subtotal) => {
  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

  if (!coupon) {
    throw new Error("Mã giảm giá không tồn tại");
  }

  if (!coupon.isActive) {
    throw new Error("Mã giảm giá đã bị vô hiệu hóa");
  }

  const now = new Date();

  if (now < new Date(coupon.startDate)) {
    throw new Error("Mã giảm giá chưa đến thời gian sử dụng");
  }

  if (now > new Date(coupon.endDate)) {
    throw new Error("Mã giảm giá đã hết hạn");
  }

  // Check total usage limit
  if (coupon.maxUsage !== null && coupon.currentUsage >= coupon.maxUsage) {
    throw new Error("Mã giảm giá đã hết lượt sử dụng");
  }

  // Check per-user usage limit
  const userUsageCount = await CouponUsage.countDocuments({
    couponId: coupon._id,
    userId
  });

  if (userUsageCount >= coupon.maxUsagePerUser) {
    throw new Error("Bạn đã sử dụng mã giảm giá này đủ số lần cho phép");
  }

  // Check minimum order amount
  if (subtotal < coupon.minOrderAmount) {
    const formatted = coupon.minOrderAmount.toLocaleString("vi-VN");
    throw new Error(`Đơn hàng tối thiểu ${formatted}đ để sử dụng mã này`);
  }

  // Check first order only
  if (coupon.isFirstOrderOnly) {
    const completedOrderCount = await Order.countDocuments({
      userId,
      status: { $ne: "cancelled" }
    });

    if (completedOrderCount > 0) {
      throw new Error("Mã giảm giá này chỉ dành cho đơn hàng đầu tiên");
    }
  }

  return coupon;
};

/**
 * Calculate the discount amount based on coupon type and order values.
 */
export const calculateDiscount = (coupon, subtotal, shippingFee = 0) => {
  let discountAmount = 0;

  switch (coupon.discountType) {
    case "percentage": {
      discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
      // Apply max discount cap
      if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
      // Cannot exceed subtotal
      discountAmount = Math.min(discountAmount, subtotal);
      break;
    }

    case "fixed_amount": {
      discountAmount = Math.min(coupon.discountValue, subtotal);
      break;
    }

    case "free_shipping": {
      if (coupon.discountValue > 0) {
        discountAmount = Math.min(coupon.discountValue, shippingFee);
      } else {
        discountAmount = shippingFee;
      }
      break;
    }

    default:
      discountAmount = 0;
  }

  return Math.max(Math.round(discountAmount), 0);
};

/**
 * Validate coupon and calculate discount in one step.
 */
export const validateAndCalculateCoupon = async (
  code,
  userId,
  subtotal,
  shippingFee = 0
) => {
  const coupon = await validateCoupon(code, userId, subtotal);
  const discountAmount = calculateDiscount(coupon, subtotal, shippingFee);

  return { coupon, discountAmount };
};

/**
 * Record a coupon usage after order creation.
 */
export const applyCoupon = async (couponId, userId, orderId, discountAmount) => {
  await CouponUsage.create({
    couponId,
    userId,
    orderId,
    discountAmount
  });

  await Coupon.findByIdAndUpdate(couponId, {
    $inc: { currentUsage: 1 }
  });
};

/**
 * Revoke coupon usage when an order is cancelled.
 * Decrements currentUsage and removes CouponUsage records.
 */
export const revokeCoupon = async (orderId) => {
  const usages = await CouponUsage.find({ orderId });

  for (const usage of usages) {
    await Coupon.findByIdAndUpdate(usage.couponId, {
      $inc: { currentUsage: -1 }
    });
  }

  await CouponUsage.deleteMany({ orderId });
};

/**
 * Get available coupons for a specific user.
 * Filters out expired, inactive, fully used, and per-user exhausted coupons.
 */
export const getAvailableCoupons = async (userId, subtotal = 0) => {
  const now = new Date();

  const coupons = await Coupon.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  })
    .sort({ createdAt: -1 })
    .lean();

  // Get user's usage counts for all coupons
  const userUsages = await CouponUsage.aggregate([
    { $match: { userId } },
    { $group: { _id: "$couponId", count: { $sum: 1 } } }
  ]);

  const usageMap = new Map(
    userUsages.map((u) => [u._id.toString(), u.count])
  );

  // Check first order eligibility once
  let hasCompletedOrders = null;

  const results = [];

  for (const coupon of coupons) {
    const couponIdStr = coupon._id.toString();

    // Check total usage
    if (coupon.maxUsage !== null && coupon.currentUsage >= coupon.maxUsage) {
      continue;
    }

    // Check per-user usage
    const userUsed = usageMap.get(couponIdStr) || 0;
    if (userUsed >= coupon.maxUsagePerUser) {
      continue;
    }

    // Check first order only
    if (coupon.isFirstOrderOnly) {
      if (hasCompletedOrders === null) {
        hasCompletedOrders =
          (await Order.countDocuments({
            userId,
            status: { $ne: "cancelled" }
          })) > 0;
      }
      if (hasCompletedOrders) {
        continue;
      }
    }

    // Calculate potential discount for preview
    const potentialDiscount = calculateDiscount(coupon, subtotal, 0);
    const isEligible = subtotal >= coupon.minOrderAmount;

    results.push({
      ...coupon,
      userUsed,
      remainingUses: coupon.maxUsagePerUser - userUsed,
      potentialDiscount,
      isEligible,
      reason: !isEligible
        ? `Đơn tối thiểu ${coupon.minOrderAmount.toLocaleString("vi-VN")}đ`
        : null
    });
  }

  return results;
};

/**
 * Get public active coupons for homepage display (no auth required).
 */
export const getPublicCoupons = async () => {
  const now = new Date();

  return Coupon.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { maxUsage: null },
      { $expr: { $lt: ["$currentUsage", "$maxUsage"] } }
    ]
  })
    .select("code description discountType discountValue maxDiscountAmount minOrderAmount startDate endDate maxUsage currentUsage")
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Admin: Get all coupons with pagination and filters.
 */
export const getAdminCoupons = async (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const filters = {};

  if (query.discountType) {
    filters.discountType = query.discountType;
  }

  if (query.isActive !== undefined && query.isActive !== "") {
    filters.isActive = query.isActive === "true";
  }

  if (query.status === "expired") {
    filters.endDate = { $lt: new Date() };
  } else if (query.status === "upcoming") {
    filters.startDate = { $gt: new Date() };
  } else if (query.status === "active") {
    const now = new Date();
    filters.isActive = true;
    filters.startDate = { $lte: now };
    filters.endDate = { $gte: now };
  }

  const [coupons, total] = await Promise.all([
    Coupon.find(filters)
      .populate("createdBy", "username fullname")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Coupon.countDocuments(filters)
  ]);

  return {
    coupons,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Admin: Get coupon details with usage statistics.
 */
export const getAdminCouponDetail = async (couponId) => {
  const coupon = await Coupon.findById(couponId)
    .populate("createdBy", "username fullname")
    .lean();

  if (!coupon) throw new Error("Không tìm thấy mã giảm giá");

  const usages = await CouponUsage.find({ couponId })
    .populate("userId", "username fullname email")
    .populate("orderId", "totalPrice status createdAt")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return { ...coupon, usages };
};

/**
 * Admin: Create a new coupon.
 */
export const createCoupon = async (data, adminId) => {
  // Validate dates
  if (new Date(data.endDate) <= new Date(data.startDate)) {
    throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
  }

  // Validate percentage value
  if (data.discountType === "percentage" && data.discountValue > 100) {
    throw new Error("Phần trăm giảm giá không được vượt quá 100%");
  }

  // Check code uniqueness
  const existing = await Coupon.findOne({
    code: data.code.toUpperCase().trim()
  });
  if (existing) {
    throw new Error("Mã giảm giá này đã tồn tại");
  }

  return Coupon.create({
    ...data,
    code: data.code.toUpperCase().trim(),
    createdBy: adminId
  });
};

/**
 * Admin: Update an existing coupon.
 */
export const updateCoupon = async (couponId, data) => {
  if (data.endDate && data.startDate) {
    if (new Date(data.endDate) <= new Date(data.startDate)) {
      throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
    }
  }

  if (data.discountType === "percentage" && data.discountValue > 100) {
    throw new Error("Phần trăm giảm giá không được vượt quá 100%");
  }

  if (data.code) {
    const existing = await Coupon.findOne({
      code: data.code.toUpperCase().trim(),
      _id: { $ne: couponId }
    });
    if (existing) {
      throw new Error("Mã giảm giá này đã tồn tại");
    }
    data.code = data.code.toUpperCase().trim();
  }

  const coupon = await Coupon.findByIdAndUpdate(couponId, data, {
    new: true,
    runValidators: true
  });

  if (!coupon) throw new Error("Không tìm thấy mã giảm giá");

  return coupon;
};

/**
 * Admin: Toggle coupon active status.
 */
export const toggleCoupon = async (couponId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw new Error("Không tìm thấy mã giảm giá");

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return coupon;
};

/**
 * Admin: Delete a coupon.
 */
export const deleteCoupon = async (couponId) => {
  const coupon = await Coupon.findByIdAndDelete(couponId);
  if (!coupon) throw new Error("Không tìm thấy mã giảm giá");

  // Also remove usage records
  await CouponUsage.deleteMany({ couponId });

  return coupon;
};
