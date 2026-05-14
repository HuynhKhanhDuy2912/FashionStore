import express from "express";
import Order from "../models/Order.js";
import { createVNPayPaymentUrl, verifyVNPayCallback } from "../utils/vnpay.js";
import { createMoMoPayment, verifyMoMoCallback } from "../utils/momo.js";
import { createPayPalOrder, capturePayPalOrder, getPayPalOrderDetails } from "../utils/paypal.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// VNPay - Tạo URL thanh toán
router.post("/vnpay/create", protect, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "orderId and amount are required"
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const ipAddr = req.headers["x-forwarded-for"] || req.connection.remoteAddress || "127.0.0.1";
    const orderInfo = `Thanh toan don hang ${orderId}`;

    const paymentUrl = createVNPayPaymentUrl(orderId, amount, orderInfo, ipAddr);

    return res.status(200).json({
      success: true,
      data: { paymentUrl }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// VNPay - Callback
router.get("/vnpay/callback", async (req, res) => {
  try {
    const vnpParams = req.query;

    const isValid = verifyVNPayCallback(vnpParams);

    if (!isValid) {
      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=Invalid signature`);
    }

    const orderId = vnpParams.vnp_TxnRef;
    const responseCode = vnpParams.vnp_ResponseCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=Order not found`);
    }

    if (responseCode === "00") {
      order.paymentStatus = "paid";
      order.transactionId = vnpParams.vnp_TransactionNo;
      await order.save();

      return res.redirect(`${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`);
    } else {
      order.paymentStatus = "failed";
      await order.save();

      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?orderId=${orderId}`);
    }
  } catch (error) {
    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=${error.message}`);
  }
});

// MoMo - Tạo thanh toán
router.post("/momo/create", protect, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "orderId and amount are required"
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const orderInfo = `Thanh toan don hang ${orderId}`;
    const result = await createMoMoPayment(orderId, amount, orderInfo);

    if (result.resultCode === 0) {
      return res.status(200).json({
        success: true,
        data: { paymentUrl: result.payUrl }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// MoMo - Callback
router.get("/momo/callback", async (req, res) => {
  try {
    const data = req.query;

    const isValid = verifyMoMoCallback(data);

    if (!isValid) {
      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=Invalid signature`);
    }

    const orderId = data.orderId;
    const resultCode = data.resultCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=Order not found`);
    }

    if (resultCode === "0") {
      order.paymentStatus = "paid";
      order.transactionId = data.transId;
      await order.save();

      return res.redirect(`${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`);
    } else {
      order.paymentStatus = "failed";
      await order.save();

      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?orderId=${orderId}`);
    }
  } catch (error) {
    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=${error.message}`);
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
        message: "Invalid signature"
      });
    }

    const orderId = data.orderId;
    const resultCode = data.resultCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (resultCode === "0") {
      order.paymentStatus = "paid";
      order.transactionId = data.transId;
      await order.save();
    } else {
      order.paymentStatus = "failed";
      await order.save();
    }

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
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
        message: "orderId and amount are required"
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Convert VND to USD (approximate rate: 1 USD = 25,000 VND)
    const amountUSD = amount / 25000;

    const paypalOrder = await createPayPalOrder(orderId, amountUSD, "USD");

    const approveLink = paypalOrder.links.find((link) => link.rel === "approve");

    return res.status(200).json({
      success: true,
      data: {
        paypalOrderId: paypalOrder.id,
        paymentUrl: approveLink.href
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// PayPal - Callback
router.get("/paypal/callback", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=Missing token`);
    }

    const paypalOrderDetails = await getPayPalOrderDetails(token);
    const orderId = paypalOrderDetails.purchase_units[0].reference_id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=Order not found`);
    }

    const captureResult = await capturePayPalOrder(token);

    if (captureResult.status === "COMPLETED") {
      order.paymentStatus = "paid";
      order.transactionId = captureResult.id;
      await order.save();

      return res.redirect(`${process.env.CLIENT_URL}/payment/success?orderId=${orderId}`);
    } else {
      order.paymentStatus = "failed";
      await order.save();

      return res.redirect(`${process.env.CLIENT_URL}/payment/failed?orderId=${orderId}`);
    }
  } catch (error) {
    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?message=${error.message}`);
  }
});

export default router;
