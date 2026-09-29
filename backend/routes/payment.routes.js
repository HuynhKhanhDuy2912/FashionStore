import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  vnpayCreate,
  vnpayCallback,
  paypalCreate,
  paypalCallback,
  paypalCancel,
} from "../controllers/payment.controller.js";

const router = express.Router();

// VNPay
router.post("/vnpay/create", protect, vnpayCreate);
router.get("/vnpay/callback", vnpayCallback);

// PayPal
router.post("/paypal/create", protect, paypalCreate);
router.get("/paypal/callback", paypalCallback);
router.get("/paypal/cancel", paypalCancel);

export default router;
