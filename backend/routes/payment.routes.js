import express from "express";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import CartItem from "../models/CartItem.js";
import OrderItem from "../models/OrderItem.js";
import Payment from "../models/Payment.js";
import { createVNPayPaymentUrl, verifyVNPayCallback } from "../utils/vnpay.js";
import { createMoMoPayment, verifyMoMoCallback } from "../utils/momo.js";
import {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrderDetails,
} from "../utils/paypal.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

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

// VNPay - Tạo URL thanh toán
router.post("/vnpay/create", protect, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "orderId and amount are required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Khôn tìm thấy đơn hàng!",
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "127.0.0.1";
    const orderInfo = `Thanh toan don hang ${orderId}`;

    const paymentUrl = createVNPayPaymentUrl(
      orderId,
      amount,
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
  try {
    const vnpParams = req.query;

    const isValid = verifyVNPayCallback(vnpParams);

    if (!isValid) {
      return res.redirect(
        `${process.env.CLIENT_URL}/payment/failed?message=Invalid signature`,
      );
    }

    const orderId = vnpParams.vnp_TxnRef;
    const responseCode = vnpParams.vnp_ResponseCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(
        `${process.env.CLIENT_URL}/checkout?error=Thanh+toán+thất+bại+hoặc+bị+hủy`,
      );
    }

    if (responseCode === "00") {
      order.paymentStatus = "paid";
      order.transactionId = vnpParams.vnp_TransactionNo;
      await order.save();

      return res.redirect(
        `${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`,
      );
    } else {
      const restoredIds = await handlePaymentFailure(orderId);
      const restoredParam =
        restoredIds.length > 0 ? `&restoredIds=${restoredIds.join(",")}` : "";
      return res.redirect(
        `${process.env.CLIENT_URL}/checkout?error=Thanh+toán+thất+bại+hoặc+bị+hủy${restoredParam}`,
      );
    }
  } catch (error) {
    return res.redirect(
      `${process.env.CLIENT_URL}/payment/failed?message=${error.message}`,
    );
  }
});

// MoMo - Tạo thanh toán
router.post("/momo/create", protect, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "orderId and amount are required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Khôn tìm thấy đơn hàng!",
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const orderInfo = `Thanh toan don hang ${orderId}`;
    const result = await createMoMoPayment(orderId, amount, orderInfo);

    if (result.resultCode === 0) {
      return res.status(200).json({
        success: true,
        data: { paymentUrl: result.payUrl },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// MoMo - Callback
router.get("/momo/callback", async (req, res) => {
  try {
    const data = req.query;

    const isValid = verifyMoMoCallback(data);

    if (!isValid) {
      return res.redirect(
        `${process.env.CLIENT_URL}/payment/failed?message=Invalid signature`,
      );
    }

    const orderId = data.orderId;
    const resultCode = data.resultCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(
        `${process.env.CLIENT_URL}/checkout?error=Thanh+toán+thất+bại+hoặc+bị+hủy`,
      );
    }

    if (resultCode === "0") {
      order.paymentStatus = "paid";
      order.transactionId = data.transId;
      await order.save();

      return res.redirect(
        `${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`,
      );
    } else {
      const restoredIds = await handlePaymentFailure(orderId);
      const restoredParam =
        restoredIds.length > 0 ? `&restoredIds=${restoredIds.join(",")}` : "";
      return res.redirect(
        `${process.env.CLIENT_URL}/checkout?error=Thanh+toán+thất+bại+hoặc+bị+hủy${restoredParam}`,
      );
    }
  } catch (error) {
    return res.redirect(
      `${process.env.CLIENT_URL}/payment/failed?message=${error.message}`,
    );
  }
});

// MoMo - IPN (webhook)
router.post("/momo/ipn", async (req, res) => {
  try {
    const data = req.body;

    const isValid = verifyMoMoCallback(data);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    const orderId = data.orderId;
    const resultCode = data.resultCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Khôn tìm thấy đơn hàng!",
      });
    }

    if (resultCode === "0") {
      order.paymentStatus = "paid";
      order.transactionId = data.transId;
      await order.save();
    } else {
      await handlePaymentFailure(orderId);
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// PayPal - Tạo order
router.post("/paypal/create", protect, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "orderId and amount are required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Khôn tìm thấy đơn hàng!",
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Convert VND to USD (approximate rate: 1 USD = 25,000 VND)
    const amountUSD = amount / 25000;

    const paypalOrder = await createPayPalOrder(orderId, amountUSD, "USD");

    const approveLink = paypalOrder.links.find(
      (link) => link.rel === "approve",
    );

    return res.status(200).json({
      success: true,
      data: {
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
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(
        `${process.env.CLIENT_URL}/payment/failed?message=Missing token`,
      );
    }

    const paypalOrderDetails = await getPayPalOrderDetails(token);
    const orderId = paypalOrderDetails.purchase_units[0].reference_id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(
        `${process.env.CLIENT_URL}/checkout?error=Thanh+toán+thất+bại+hoặc+bị+hủy`,
      );
    }

    const captureResult = await capturePayPalOrder(token);

    if (captureResult.status === "COMPLETED") {
      order.paymentStatus = "paid";
      order.transactionId = captureResult.id;
      await order.save();

      return res.redirect(
        `${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`,
      );
    } else {
      const restoredIds = await handlePaymentFailure(orderId);
      const restoredParam =
        restoredIds.length > 0 ? `&restoredIds=${restoredIds.join(",")}` : "";
      return res.redirect(
        `${process.env.CLIENT_URL}/checkout?error=Thanh+toán+thất+bại+hoặc+bị+hủy${restoredParam}`,
      );
    }
  } catch (error) {
    return res.redirect(
      `${process.env.CLIENT_URL}/payment/failed?message=${error.message}`,
    );
  }
});

// PayPal - Cancel
router.get("/paypal/cancel", async (req, res) => {
  const { orderId } = req.query;
  let restoredParam = "";
  if (orderId) {
    const restoredIds = await handlePaymentFailure(orderId);
    if (restoredIds.length > 0) {
      restoredParam = `&restoredIds=${restoredIds.join(",")}`;
    }
  }
  return res.redirect(
    `${process.env.CLIENT_URL}/checkout?error=Thanh+toán+bị+hủy${restoredParam}`,
  );
});

export default router;
