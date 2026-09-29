import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import CartItem from "../models/CartItem.js";
import OrderItem from "../models/OrderItem.js";
import Payment from "../models/Payment.js";
import PaymentSession from "../models/PaymentSession.js";
import User from "../models/User.js";
import { sendOrderConfirmationEmail } from "./orderEmail.service.js";
import { createVNPayPaymentUrl, verifyVNPayCallback } from "../utils/vnpay.js";
import {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrderDetails,
} from "../utils/paypal.js";
import {
  createOrderFromCart,
  grantRewardCoupons,
  previewOrderFromCart,
} from "./order.service.js";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// ─── Shared Helpers ──────────────────────────────────────

export const buildCheckoutRedirectUrl = (message, restoredIds = []) => {
  const queryParams = new URLSearchParams({ error: message });
  const normalizedRestoredIds = restoredIds.filter(Boolean).map(String);

  if (normalizedRestoredIds.length > 0) {
    queryParams.set("restoredIds", normalizedRestoredIds.join(","));
  }

  return `${CLIENT_URL}/checkout?${queryParams.toString()}`;
};

export const buildSuccessRedirectUrl = (orderId, awardedCoupons) => {
  const queryParams = new URLSearchParams({ orderId: orderId.toString() });
  if (awardedCoupons && awardedCoupons.length > 0) {
    queryParams.append("awardedCoupons", "true");
  }
  return `${CLIENT_URL}/payment/success?${queryParams.toString()}`;
};

const selectedIdsFromSession = (session) => {
  const ids = session?.checkoutPayload?.selectedItemIds;
  return Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
};

const markPaymentPaid = async (orderId, transactionId) => {
  await Payment.findOneAndUpdate(
    { orderId },
    { paymentStatus: "paid", transactionId, paidAt: new Date() },
  );
};

const handlePaymentFailure = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) return [];

  const restoredIds = [];

  const items = await OrderItem.find({ orderId: order._id });
  const cart = await Cart.findOne({ userId: order.userId });
  if (cart && items.length > 0) {
    for (const item of items) {
      const existing = await CartItem.findOne({
        cartId: cart._id,
        variantId: item.variantId,
      });
      if (existing) {
        existing.quantity += item.quantity;
        await existing.save();
        restoredIds.push(existing._id.toString());
      } else {
        const newCartItem = await CartItem.create({
          cartId: cart._id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        });
        restoredIds.push(newCartItem._id.toString());
      }
    }
  }

  await Payment.deleteMany({ orderId: order._id });
  await OrderItem.deleteMany({ orderId: order._id });
  await Order.findByIdAndDelete(order._id);

  return restoredIds;
};

/**
 * Post-payment success: update order/payment status, send email, grant coupons.
 * Returns { successUrl }
 */
const finalizeSuccessfulPayment = async (order, transactionId, user) => {
  await Order.findByIdAndUpdate(order._id, {
    paymentStatus: "paid",
    transactionId,
  });
  await markPaymentPaid(order._id, transactionId);

  // Fire-and-forget: gửi email xác nhận đơn hàng
  const emailItems = await OrderItem.find({ orderId: order._id });
  sendOrderConfirmationEmail(order, emailItems, user).catch((err) =>
    console.error("Failed to send confirmation email:", err.message),
  );

  const awardedCoupons = await grantRewardCoupons(order.userId, order.subTotal);
  const successUrl = buildSuccessRedirectUrl(order._id, awardedCoupons);

  return { successUrl };
};

// ─── VNPay ───────────────────────────────────────────────

export const createVNPaySession = async (user, body, ipAddr) => {
  const checkoutPayload = {
    ...body,
    paymentMethod: "vnpay",
  };
  const preview = await previewOrderFromCart(user, checkoutPayload);

  if (preview.totalPrice <= 0) {
    throw Object.assign(new Error("Số tiền thanh toán phải lớn hơn 0"), {
      statusCode: 400,
    });
  }

  checkoutPayload.selectedItemIds = preview.selectedItemIds;
  delete checkoutPayload.cartItemIds;

  const session = await PaymentSession.create({
    userId: user._id,
    provider: "vnpay",
    checkoutPayload,
    amount: preview.totalPrice,
  });

  const orderInfo = `Thanh toan don hang ${session._id}`;

  // vnp_TxnRef = sessionId (đơn hàng chỉ được tạo sau khi thanh toán thành công)
  const paymentUrl = createVNPayPaymentUrl(
    session._id.toString(),
    preview.totalPrice,
    orderInfo,
    ipAddr,
  );

  return { paymentUrl };
};

export const handleVNPayCallback = async (vnpParams) => {
  let session = null;
  let order = null;
  let paid = false;

  try {
    const responseCode = vnpParams.vnp_ResponseCode;
    const sessionId = vnpParams.vnp_TxnRef;

    if (!verifyVNPayCallback(vnpParams)) {
      return {
        type: "redirect",
        url: `${CLIENT_URL}/payment/failed?message=Invalid signature`,
      };
    }

    session = await PaymentSession.findById(sessionId);
    if (!session) {
      return {
        type: "checkout_redirect",
        message: "Phiên thanh toán không còn hiệu lực",
        restoredIds: [],
      };
    }

    // Idempotent: phiên đã hoàn tất trước đó
    if (session.status === "completed" && session.orderId) {
      return {
        type: "redirect",
        url: buildSuccessRedirectUrl(session.orderId, null),
      };
    }

    if (session.status !== "created") {
      return {
        type: "checkout_redirect",
        message: "Phiên thanh toán không còn hiệu lực",
        restoredIds: selectedIdsFromSession(session),
      };
    }

    if (responseCode !== "00") {
      session.status = "failed";
      await session.save();
      return {
        type: "checkout_redirect",
        message: "Thanh toán thất bại hoặc bị hủy",
        restoredIds: selectedIdsFromSession(session),
      };
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return {
        type: "checkout_redirect",
        message: "Không tìm thấy tài khoản thanh toán",
        restoredIds: selectedIdsFromSession(session),
      };
    }

    // Thanh toán thành công → mới tạo đơn hàng
    order = await createOrderFromCart(user, {
      ...session.checkoutPayload,
      paymentMethod: "vnpay",
    });

    if (Number(order.totalPrice) !== Number(session.amount)) {
      throw new Error("Tổng tiền đã thay đổi, vui lòng thanh toán lại");
    }

    const { successUrl } = await finalizeSuccessfulPayment(
      order,
      vnpParams.vnp_TransactionNo,
      user,
    );
    paid = true; // Đã thu tiền thành công → không rollback đơn này nữa

    session.status = "completed";
    session.orderId = order._id;
    await session.save();

    return { type: "redirect", url: successUrl };
  } catch (error) {
    // Nếu đã thu tiền thành công thì KHÔNG xóa đơn (tránh mất đơn đã thanh toán)
    if (paid && order?._id) {
      return {
        type: "redirect",
        url: buildSuccessRedirectUrl(order._id, null),
      };
    }

    let restoredIds = session ? selectedIdsFromSession(session) : [];

    if (order?._id) {
      restoredIds = await handlePaymentFailure(order._id);
    }

    if (session) {
      session.status = "failed";
      await session.save().catch(() => {});
    }

    return {
      type: "checkout_redirect",
      message: error.message || "Thanh toán thất bại hoặc bị hủy",
      restoredIds,
    };
  }
};

// ─── PayPal ──────────────────────────────────────────────

export const createPayPalSession = async (user, body) => {
  const checkoutPayload = {
    ...body,
    paymentMethod: "paypal",
  };
  const preview = await previewOrderFromCart(user, checkoutPayload);

  if (preview.totalPrice <= 0) {
    throw Object.assign(new Error("PayPal amount must be greater than 0"), {
      statusCode: 400,
    });
  }

  checkoutPayload.selectedItemIds = preview.selectedItemIds;
  delete checkoutPayload.cartItemIds;

  const session = await PaymentSession.create({
    userId: user._id,
    provider: "paypal",
    checkoutPayload,
    amount: preview.totalPrice,
  });

  // Convert VND to USD (approximate rate: 1 USD = 25,000 VND)
  const amountUSD = preview.totalPrice / 25000;

  const paypalOrder = await createPayPalOrder(
    session._id.toString(),
    amountUSD,
    "USD",
  );

  const approveLink = paypalOrder.links.find(
    (link) => link.rel === "approve",
  );

  if (!approveLink?.href) {
    throw new Error("PayPal approval link not found");
  }

  session.providerOrderId = paypalOrder.id;
  await session.save();

  return {
    sessionId: session._id,
    paypalOrderId: paypalOrder.id,
    paymentUrl: approveLink.href,
  };
};

export const handlePayPalCallback = async (token) => {
  let session = null;
  let order = null;
  let paid = false;

  try {
    if (!token) {
      return {
        type: "redirect",
        url: `${CLIENT_URL}/payment/failed?message=Missing token`,
      };
    }

    const paypalOrderDetails = await getPayPalOrderDetails(token);
    const sessionId = paypalOrderDetails.purchase_units?.[0]?.reference_id;

    if (!sessionId) {
      return {
        type: "checkout_redirect",
        message: "Không tìm thấy phiên thanh toán PayPal",
        restoredIds: [],
      };
    }

    session = await PaymentSession.findById(sessionId);
    if (!session) {
      return {
        type: "checkout_redirect",
        message: "Phiên thanh toán PayPal không còn hiệu lực",
        restoredIds: [],
      };
    }

    if (session.status === "completed" && session.orderId) {
      return {
        type: "redirect",
        url: buildSuccessRedirectUrl(session.orderId, null),
      };
    }

    if (session.status !== "created") {
      return {
        type: "checkout_redirect",
        message: "Phiên thanh toán PayPal không còn hiệu lực",
        restoredIds: selectedIdsFromSession(session),
      };
    }

    if (session.providerOrderId && session.providerOrderId !== token) {
      return {
        type: "checkout_redirect",
        message: "Mã thanh toán PayPal không hợp lệ",
        restoredIds: selectedIdsFromSession(session),
      };
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return {
        type: "checkout_redirect",
        message: "Không tìm thấy tài khoản thanh toán",
        restoredIds: selectedIdsFromSession(session),
      };
    }

    order = await createOrderFromCart(user, {
      ...session.checkoutPayload,
      paymentMethod: "paypal",
    });

    if (Number(order.totalPrice) !== Number(session.amount)) {
      throw new Error("Tổng tiền đã thay đổi, vui lòng thanh toán lại");
    }

    const captureResult = await capturePayPalOrder(token);

    if (captureResult.status === "COMPLETED") {
      const { successUrl } = await finalizeSuccessfulPayment(
        order,
        captureResult.id,
        user,
      );
      paid = true; // Đã thu tiền thành công → không rollback đơn này nữa

      session.status = "completed";
      session.orderId = order._id;
      await session.save();

      return { type: "redirect", url: successUrl };
    } else {
      const restoredIds = await handlePaymentFailure(order._id);
      session.status = "failed";
      await session.save();
      return {
        type: "checkout_redirect",
        message: "Thanh toán thất bại hoặc bị hủy",
        restoredIds,
      };
    }
  } catch (error) {
    // Nếu đã thu tiền thành công thì KHÔNG xóa đơn (tránh mất đơn đã thanh toán)
    if (paid && order?._id) {
      return {
        type: "redirect",
        url: buildSuccessRedirectUrl(order._id, null),
      };
    }

    let restoredIds = session ? selectedIdsFromSession(session) : [];

    if (order?._id) {
      restoredIds = await handlePaymentFailure(order._id);
    }

    if (session) {
      session.status = "failed";
      await session.save().catch(() => {});
    }

    return {
      type: "checkout_redirect",
      message: error.message || "Thanh toán thất bại hoặc bị hủy",
      restoredIds,
    };
  }
};

export const handlePayPalCancel = async (orderId, sessionId) => {
  if (sessionId) {
    const session = await PaymentSession.findById(sessionId);
    const restoredIds = selectedIdsFromSession(session);

    if (session && session.status === "created") {
      session.status = "cancelled";
      await session.save();
    }

    return { message: "Thanh toán bị hủy", restoredIds };
  }

  if (orderId) {
    const restoredIds = await handlePaymentFailure(orderId);
    return { message: "Thanh toán bị hủy", restoredIds };
  }

  return { message: "Thanh toán bị hủy", restoredIds: [] };
};
