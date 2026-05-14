import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const PHONE_OTP_TTL_MS = 5 * 60 * 1000;
const PHONE_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizePhone = (phoneNumber = "") => phoneNumber.replace(/[^\d+]/g, "").trim();
const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];
const maskPhoneNumber = (phoneNumber = "") => {
  if (phoneNumber.length <= 4) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-3)}`;
};

const generateUsername = (seed = "user") => {
  const normalized = seed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  return `${normalized || "user"}${Date.now().toString().slice(-6)}`;
};

const generatePhoneEmail = (phoneNumber) =>
  `phone_${phoneNumber.replace(/[^\d]/g, "")}@phone.local`;

const signToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );

const sanitizeUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  googleId: user.googleId,
  avatar: user.avatar,
  full_name: user.full_name,
  gender: user.gender,
  bodyShape: user.bodyShape,
  favoriteStyles: user.favoriteStyles,
  favoriteColors: user.favoriteColors,
  sizeProfile: user.sizeProfile,
  budgetRange: user.budgetRange,
  role: user.role,
  address: user.address,
  phone_number: user.phone_number,
  authProviders: user.authProviders,
  isPhoneVerified: user.isPhoneVerified,
  isActive: user.isActive,
  city: user.city,
  dateOfBirth: user.dateOfBirth,
  height: user.height,
  weight: user.weight,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const issueAuthResponse = (res, user, statusCode, message) =>
  res.status(statusCode).json({
    success: true,
    message,
    data: {
      user: sanitizeUser(user),
      token: signToken(user)
    }
  });

export const register = async (req, res) => {
  try {
    const { username, email, password, phone_number } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone_number);

    if (!username || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "username, email and password are required"
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists"
      });
    }

    if (normalizedPhone) {
      const phoneExists = await User.findOne({ phone_number: normalizedPhone });

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "Phone number already exists"
        });
      }
    }

    const user = await User.create({
      ...req.body,
      email: normalizedEmail,
      phone_number: normalizedPhone || undefined,
      authProviders: ["email"]
    });

    return issueAuthResponse(res, user, 201, "Register successful");
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required"
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    return issueAuthResponse(res, user, 200, "Login successful");
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Current user fetched successfully",
    data: req.user
  });
};

export const googleAuth = async (req, res) => {
  try {
    const { credential, full_name } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "GOOGLE_CLIENT_ID is not configured"
      });
    }

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required"
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({
        success: false,
        message: "Unable to verify Google account email"
      });
    }

    const normalizedEmail = normalizeEmail(payload.email);
    let user =
      (await User.findOne({ googleId: payload.sub })) ||
      (await User.findOne({ email: normalizedEmail }));

    if (!user) {
      user = await User.create({
        username: generateUsername(normalizedEmail.split("@")[0]),
        email: normalizedEmail,
        googleId: payload.sub,
        full_name: full_name || payload.name || "",
        avatar: payload.picture || "",
        authProviders: ["google"]
      });
    } else {
      user.googleId = user.googleId || payload.sub;
      user.email = user.email || normalizedEmail;
      user.full_name = user.full_name || full_name || payload.name || "";
      user.avatar = user.avatar || payload.picture || "";
      user.authProviders = uniqueValues([...(user.authProviders || []), "google"]);
      await user.save();
    }

    return issueAuthResponse(res, user, 200, "Google login successful");
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || "Google authentication failed"
    });
  }
};

export const requestPhoneOtp = async (req, res) => {
  try {
    const { phone_number, full_name } = req.body;
    const normalizedPhone = normalizePhone(phone_number);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "phone_number is required"
      });
    }

    let user = await User.findOne({ phone_number: normalizedPhone }).select(
      "+phoneOtpCode +phoneOtpExpiresAt +phoneOtpLastSentAt"
    );

    if (!user) {
      user = await User.create({
        username: generateUsername(normalizedPhone.slice(-4)),
        email: generatePhoneEmail(normalizedPhone),
        phone_number: normalizedPhone,
        full_name: full_name || "",
        authProviders: ["phone"]
      });
      user = await User.findById(user._id).select(
        "+phoneOtpCode +phoneOtpExpiresAt +phoneOtpLastSentAt"
      );
    }

    if (user.phoneOtpLastSentAt) {
      const elapsedMs = Date.now() - user.phoneOtpLastSentAt.getTime();

      if (elapsedMs < PHONE_OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil(
          (PHONE_OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000
        );

        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfterSeconds}s before requesting a new OTP`
        });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otpCode).digest("hex");

    user.phoneOtpCode = hashedOtp;
    user.phoneOtpExpiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS);
    user.phoneOtpLastSentAt = new Date();
    user.authProviders = uniqueValues([...(user.authProviders || []), "phone"]);

    if (full_name && !user.full_name) {
      user.full_name = full_name;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      data: {
        phone_number: normalizedPhone,
        maskedPhoneNumber: maskPhoneNumber(normalizedPhone),
        deliveryChannel: process.env.NODE_ENV === "production" ? "sms" : "demo_inbox",
        expiresInSeconds: PHONE_OTP_TTL_MS / 1000,
        resendCooldownSeconds: PHONE_OTP_RESEND_COOLDOWN_MS / 1000,
        ...(process.env.NODE_ENV !== "production"
          ? {
              demoOtp: otpCode,
              demoMessage: `Ma xac thuc FashionStore cua ban la ${otpCode}. Hieu luc trong 5 phut.`
            }
          : {})
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone_number, otp, full_name } = req.body;
    const normalizedPhone = normalizePhone(phone_number);

    if (!normalizedPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: "phone_number and otp are required"
      });
    }

    const user = await User.findOne({ phone_number: normalizedPhone }).select(
      "+phoneOtpCode +phoneOtpExpiresAt +phoneOtpLastSentAt"
    );

    if (!user || !user.phoneOtpCode || !user.phoneOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP request not found"
      });
    }

    if (user.phoneOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired"
      });
    }

    const hashedOtp = crypto.createHash("sha256").update(String(otp)).digest("hex");

    if (hashedOtp !== user.phoneOtpCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    user.phoneOtpCode = "";
    user.phoneOtpExpiresAt = null;
    user.isPhoneVerified = true;
    user.authProviders = uniqueValues([...(user.authProviders || []), "phone"]);

    if (full_name && !user.full_name) {
      user.full_name = full_name;
    }

    await user.save();

    return issueAuthResponse(res, user, 200, "Phone login successful");
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const {
      full_name,
      gender,
      bodyShape,
      favoriteStyles,
      favoriteColors,
      sizeProfile,
      budgetRange,
      address,
      phone_number,
      avatar,
      city,
      dateOfBirth,
      height,
      weight
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (phone_number) {
      const normalizedPhone = normalizePhone(phone_number);
      const phoneExists = await User.findOne({
        phone_number: normalizedPhone,
        _id: { $ne: user._id }
      });

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "Phone number already exists"
        });
      }

      user.phone_number = normalizedPhone;
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (gender !== undefined) user.gender = gender;
    if (bodyShape !== undefined) user.bodyShape = bodyShape;
    if (favoriteStyles !== undefined) user.favoriteStyles = favoriteStyles;
    if (favoriteColors !== undefined) user.favoriteColors = favoriteColors;
    if (sizeProfile !== undefined) user.sizeProfile = sizeProfile;
    if (budgetRange !== undefined) user.budgetRange = budgetRange;
    if (address !== undefined) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;
    if (city !== undefined) user.city = city;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (height !== undefined) user.height = height;
    if (weight !== undefined) user.weight = weight;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters"
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account does not have a password set"
      });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
