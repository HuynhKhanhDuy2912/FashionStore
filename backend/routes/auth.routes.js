import express from "express";
import {
  getMe,
  googleAuth,
  login,
  register,
  firebasePhoneAuth,
  updateProfile,
  changePassword,
  sendRegisterOTP,
  sendResetPasswordOTP,
  resetPassword,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/send-register-otp", sendRegisterOTP);
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/firebase-phone", firebasePhoneAuth);
router.post("/send-reset-otp", sendResetPasswordOTP);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
