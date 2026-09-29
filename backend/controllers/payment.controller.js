import {
  createVNPaySession,
  handleVNPayCallback,
  createPayPalSession,
  handlePayPalCallback,
  handlePayPalCancel,
  buildCheckoutRedirectUrl,
} from "../services/payment.service.js";

// ─── VNPay ───────────────────────────────────────────────

export const vnpayCreate = async (req, res) => {
  try {
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "127.0.0.1";

    const result = await createVNPaySession(req.user, req.body, ipAddr);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const vnpayCallback = async (req, res) => {
  try {
    const result = await handleVNPayCallback(req.query);

    if (result.type === "redirect") {
      return res.redirect(result.url);
    }

    // type === "checkout_redirect"
    return res.redirect(
      buildCheckoutRedirectUrl(result.message, result.restoredIds),
    );
  } catch (error) {
    return res.redirect(
      buildCheckoutRedirectUrl(error.message || "Thanh toán thất bại"),
    );
  }
};

// ─── PayPal ──────────────────────────────────────────────

export const paypalCreate = async (req, res) => {
  try {
    const result = await createPayPalSession(req.user, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const paypalCallback = async (req, res) => {
  try {
    const result = await handlePayPalCallback(req.query.token);

    if (result.type === "redirect") {
      return res.redirect(result.url);
    }

    // type === "checkout_redirect"
    return res.redirect(
      buildCheckoutRedirectUrl(result.message, result.restoredIds),
    );
  } catch (error) {
    return res.redirect(
      buildCheckoutRedirectUrl(error.message || "Thanh toán thất bại"),
    );
  }
};

export const paypalCancel = async (req, res) => {
  try {
    const { orderId, sessionId } = req.query;
    const result = await handlePayPalCancel(orderId, sessionId);

    return res.redirect(
      buildCheckoutRedirectUrl(result.message, result.restoredIds),
    );
  } catch (error) {
    return res.redirect(
      buildCheckoutRedirectUrl(error.message || "Thanh toán bị hủy"),
    );
  }
};
