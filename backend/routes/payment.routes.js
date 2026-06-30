import express from "express";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import CartItem from "../models/CartItem.js";
import OrderItem from "../models/OrderItem.js";
import Payment from "../models/Payment.js";
import PaymentSession from "../models/PaymentSession.js";
import User from "../models/User.js";
import { sendOrderConfirmationEmail } from "../services/orderEmail.service.js";
import { createVNPayPaymentUrl, verifyVNPayCallback } from "../utils/vnpay.js";
import {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrderDetails,
} from "../utils/paypal.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  createOrderFromCart,
  grantRewardCoupons,
  previewOrderFromCart,
} from "../services/order.service.js";

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const redirectToCheckout = (res, message, restoredIds = []) => {
  const queryParams = new URLSearchParams({ error: message });
  const normalizedRestoredIds = restoredIds.filter(Boolean).map(String);

  if (normalizedRestoredIds.length > 0) {
    queryParams.set("restoredIds", normalizedRestoredIds.join(","));
  }

  return res.redirect(`${CLIENT_URL}/checkout?${queryParams.toString()}`);
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

// VNPay - Tạo URL thanh toán (tạo PaymentSession, CHƯA tạo đơn hàng)
router.post("/vnpay/create", protect, async (req, res) => {
  try {
    const checkoutPayload = {
      ...req.body,
      paymentMethod: "vnpay",
    };
    const preview = await previewOrderFromCart(req.user, checkoutPayload);

    if (preview.totalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán phải lớn hơn 0",
      });
    }

    checkoutPayload.selectedItemIds = preview.selectedItemIds;
    delete checkoutPayload.cartItemIds;

    const session = await PaymentSession.create({
      userId: req.user._id,
      provider: "vnpay",
      checkoutPayload,
      amount: preview.totalPrice,
    });

    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "127.0.0.1";
    const orderInfo = `Thanh toan don hang ${session._id}`;

    // vnp_TxnRef = sessionId (đơn hàng chỉ được tạo sau khi thanh toán thành công)
    const paymentUrl = createVNPayPaymentUrl(
      session._id.toString(),
      preview.totalPrice,
      orderInfo,
      ipAddr,
    );

    return res.status(200).json({
      success: true,
      data: { paymentUrl },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// VNPay - Callback
router.get("/vnpay/callback", async (req, res) => {
  let session = null;
  let order = null;
  let paid = false;

  try {
    const vnpParams = req.query;
    const responseCode = vnpParams.vnp_ResponseCode;
    const sessionId = vnpParams.vnp_TxnRef;

    if (!verifyVNPayCallback(vnpParams)) {
      return res.redirect(
        `${process.env.CLIENT_URL}/payment/failed?message=Invalid signature`,
      );
    }

    session = await PaymentSession.findById(sessionId);
    if (!session) {
      return redirectToCheckout(res, "Phiên thanh toán không còn hiệu lực");
    }

    // Idempotent: phiên đã hoàn tất trước đó
    if (session.status === "completed" && session.orderId) {
      const queryParams = new URLSearchParams({
        orderId: session.orderId.toString(),
      });
      return res.redirect(`${CLIENT_URL}/payment/success?${queryParams.toString()}`);
    }

    if (session.status !== "created") {
      return redirectToCheckout(
        res,
        "Phiên thanh toán không còn hiệu lực",
        selectedIdsFromSession(session),
      );
    }

    if (responseCode !== "00") {
      session.status = "failed";
      await session.save();
      return redirectToCheckout(
        res,
        "Thanh toán thất bại hoặc bị hủy",
        selectedIdsFromSession(session),
      );
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return redirectToCheckout(
        res,
        "Không tìm thấy tài khoản thanh toán",
        selectedIdsFromSession(session),
      );
    }

    // Thanh toán thành công → mới tạo đơn hàng
    order = await createOrderFromCart(user, {
      ...session.checkoutPayload,
      paymentMethod: "vnpay",
    });

    if (Number(order.totalPrice) !== Number(session.amount)) {
      throw new Error("Tổng tiền đã thay đổi, vui lòng thanh toán lại");
    }

    await Order.findByIdAndUpdate(order._id, {
      paymentStatus: "paid",
      transactionId: vnpParams.vnp_TransactionNo,
    });
    await markPaymentPaid(order._id, vnpParams.vnp_TransactionNo);
    paid = true; // Đã thu tiền thành công → không rollback đơn này nữa

    // Fire-and-forget: gửi email xác nhận đơn hàng (VNPay)
    const emailItems = await OrderItem.find({ orderId: order._id });
    sendOrderConfirmationEmail(order, emailItems, user).catch((err) =>
      console.error("Failed to send VNPay confirmation email:", err.message),
    );

    const awardedCoupons = await grantRewardCoupons(order.userId, order.subTotal);
    const queryParams = new URLSearchParams({ orderId: order._id.toString() });
    if (awardedCoupons && awardedCoupons.length > 0) {
      queryParams.append("awardedCoupons", "true");
    }

    session.status = "completed";
    session.orderId = order._id;
    await session.save();

    return res.redirect(
      `${CLIENT_URL}/payment/success?${queryParams.toString()}`,
    );
  } catch (error) {
    // Nếu đã thu tiền thành công thì KHÔNG xóa đơn (tránh mất đơn đã thanh toán)
    if (paid && order?._id) {
      const queryParams = new URLSearchParams({ orderId: order._id.toString() });
      return res.redirect(`${CLIENT_URL}/payment/success?${queryParams.toString()}`);
    }

    let restoredIds = session ? selectedIdsFromSession(session) : [];

    if (order?._id) {
      restoredIds = await handlePaymentFailure(order._id);
    }

    if (session) {
      session.status = "failed";
      await session.save().catch(() => {});
    }

    return redirectToCheckout(
      res,
      error.message || "Thanh toán thất bại hoặc bị hủy",
      restoredIds,
    );
  }
});



// PayPal - Tạo order
router.post("/paypal/create", protect, async (req, res) => {
  try {
    const checkoutPayload = {
      ...req.body,
      paymentMethod: "paypal",
    };
    const preview = await previewOrderFromCart(req.user, checkoutPayload);

    if (preview.totalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "PayPal amount must be greater than 0",
      });
    }

    checkoutPayload.selectedItemIds = preview.selectedItemIds;
    delete checkoutPayload.cartItemIds;

    const session = await PaymentSession.create({
      userId: req.user._id,
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

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session._id,
        paypalOrderId: paypalOrder.id,
        paymentUrl: approveLink.href,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// PayPal - Callback
router.get("/paypal/callback", async (req, res) => {
  let session = null;
  let order = null;
  let paid = false;

  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(
        `${process.env.CLIENT_URL}/payment/failed?message=Missing token`,
      );
    }

    const paypalOrderDetails = await getPayPalOrderDetails(token);
    const sessionId = paypalOrderDetails.purchase_units?.[0]?.reference_id;

    if (!sessionId) {
      return redirectToCheckout(
        res,
        "Không tìm thấy phiên thanh toán PayPal",
      );
    }

    session = await PaymentSession.findById(sessionId);
    if (!session) {
      return redirectToCheckout(
        res,
        "Phiên thanh toán PayPal không còn hiệu lực",
      );
    }

    if (session.status === "completed" && session.orderId) {
      const queryParams = new URLSearchParams({
        orderId: session.orderId.toString(),
      });
      return res.redirect(`${CLIENT_URL}/payment/success?${queryParams.toString()}`);
    }

    if (session.status !== "created") {
      return redirectToCheckout(
        res,
        "Phiên thanh toán PayPal không còn hiệu lực",
        selectedIdsFromSession(session),
      );
    }

    if (session.providerOrderId && session.providerOrderId !== token) {
      return redirectToCheckout(
        res,
        "Mã thanh toán PayPal không hợp lệ",
        selectedIdsFromSession(session),
      );
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return redirectToCheckout(
        res,
        "Không tìm thấy tài khoản thanh toán",
        selectedIdsFromSession(session),
      );
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
      // createOrderFromCart trả về object đã .lean() nên không có .save();
      // cập nhật trạng thái thanh toán qua findByIdAndUpdate
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "paid",
        transactionId: captureResult.id,
      });
      await markPaymentPaid(order._id, captureResult.id);
      paid = true; // Đã thu tiền thành công → không rollback đơn này nữa

      // Fire-and-forget: gửi email xác nhận đơn hàng (PayPal)
      const emailItems = await OrderItem.find({ orderId: order._id });
      sendOrderConfirmationEmail(order, emailItems, user).catch((err) =>
        console.error("Failed to send PayPal confirmation email:", err.message),
      );

      const awardedCoupons = await grantRewardCoupons(order.userId, order.subTotal);
      const queryParams = new URLSearchParams({ orderId: order._id.toString() });
      if (awardedCoupons && awardedCoupons.length > 0) {
        queryParams.append("awardedCoupons", "true");
      }

      session.status = "completed";
      session.orderId = order._id;
      await session.save();

      return res.redirect(
        `${CLIENT_URL}/payment/success?${queryParams.toString()}`
      );
    } else {
      const restoredIds = await handlePaymentFailure(order._id);
      session.status = "failed";
      await session.save();
      return redirectToCheckout(
        res,
        "Thanh toán thất bại hoặc bị hủy",
        restoredIds,
      );
    }
  } catch (error) {
    // Nếu đã thu tiền thành công thì KHÔNG xóa đơn (tránh mất đơn đã thanh toán)
    if (paid && order?._id) {
      const queryParams = new URLSearchParams({ orderId: order._id.toString() });
      return res.redirect(`${CLIENT_URL}/payment/success?${queryParams.toString()}`);
    }

    let restoredIds = session ? selectedIdsFromSession(session) : [];

    if (order?._id) {
      restoredIds = await handlePaymentFailure(order._id);
    }

    if (session) {
      session.status = "failed";
      await session.save().catch(() => {});
    }

    return redirectToCheckout(
      res,
      error.message || "Thanh toán thất bại hoặc bị hủy",
      restoredIds,
    );
  }
});

// PayPal - Cancel
router.get("/paypal/cancel", async (req, res) => {
  try {
    const { orderId, sessionId } = req.query;

    if (sessionId) {
      const session = await PaymentSession.findById(sessionId);
      const restoredIds = selectedIdsFromSession(session);

      if (session && session.status === "created") {
        session.status = "cancelled";
        await session.save();
      }

      return redirectToCheckout(res, "Thanh toán bị hủy", restoredIds);
    }

    if (orderId) {
      const restoredIds = await handlePaymentFailure(orderId);
      return redirectToCheckout(res, "Thanh toán bị hủy", restoredIds);
    }

    return redirectToCheckout(res, "Thanh toán bị hủy");
  } catch (error) {
    return redirectToCheckout(
      res,
      error.message || "Thanh toán bị hủy",
    );
  }
});

export default router;
