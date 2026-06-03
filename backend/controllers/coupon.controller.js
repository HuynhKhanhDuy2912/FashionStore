import {
  getAdminCoupons,
  getAdminCouponDetail,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
  validateAndCalculateCoupon,
  getAvailableCoupons,
  getPublicCoupons
} from "../services/coupon.service.js";

// ─── Admin ───────────────────────────────────────────────

export const adminListCoupons = async (req, res) => {
  try {
    const result = await getAdminCoupons(req.query);

    return res.status(200).json({
      success: true,
      message: "Coupons fetched successfully",
      data: result.coupons,
      pagination: result.pagination
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const adminGetCoupon = async (req, res) => {
  try {
    const coupon = await getAdminCouponDetail(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Coupon fetched successfully",
      data: coupon
    });
  } catch (error) {
    const statusCode = error.message === "Không tìm thấy mã giảm giá" ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const adminCreateCoupon = async (req, res) => {
  try {
    const coupon = await createCoupon(req.body, req.user._id);

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const adminUpdateCoupon = async (req, res) => {
  try {
    const coupon = await updateCoupon(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon
    });
  } catch (error) {
    const statusCode = error.message === "Không tìm thấy mã giảm giá" ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const adminDeleteCoupon = async (req, res) => {
  try {
    await deleteCoupon(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully"
    });
  } catch (error) {
    const statusCode = error.message === "Không tìm thấy mã giảm giá" ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const adminToggleCoupon = async (req, res) => {
  try {
    const coupon = await toggleCoupon(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
      data: coupon
    });
  } catch (error) {
    const statusCode = error.message === "Không tìm thấy mã giảm giá" ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// ─── User ────────────────────────────────────────────────

export const applyCouponPreview = async (req, res) => {
  try {
    const { code, subtotal, shippingFee = 0 } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mã giảm giá"
      });
    }

    const result = await validateAndCalculateCoupon(
      code,
      req.user._id,
      subtotal || 0,
      shippingFee
    );

    return res.status(200).json({
      success: true,
      message: "Mã giảm giá hợp lệ",
      data: {
        coupon: {
          _id: result.coupon._id,
          code: result.coupon.code,
          description: result.coupon.description,
          discountType: result.coupon.discountType,
          discountValue: result.coupon.discountValue,
          maxDiscountAmount: result.coupon.maxDiscountAmount,
          minOrderAmount: result.coupon.minOrderAmount
        },
        discountAmount: result.discountAmount
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const listAvailableCoupons = async (req, res) => {
  try {
    const subtotal = Number(req.query.subtotal) || 0;
    const coupons = await getAvailableCoupons(req.user._id, subtotal);

    return res.status(200).json({
      success: true,
      message: "Available coupons fetched successfully",
      data: coupons
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const listPublicCoupons = async (_req, res) => {
  try {
    const coupons = await getPublicCoupons();

    return res.status(200).json({
      success: true,
      message: "Public coupons fetched successfully",
      data: coupons
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  adminListCoupons,
  adminGetCoupon,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
  adminToggleCoupon,
  applyCouponPreview,
  listAvailableCoupons,
  listPublicCoupons
};
