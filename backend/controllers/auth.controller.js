import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { verifyFirebaseToken } from "../config/firebase.js";
import NodeCache from "node-cache";
import { sendOTPEmail } from "../services/mail.service.js";

const otpCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizePhone = (phoneNumber = "") =>
  phoneNumber.replace(/[^\d+]/g, "").trim();
const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];
const isGoogleAvatar = (avatar = "") =>
  /googleusercontent\.com|ggpht\.com/i.test(avatar);

const generateUsername = (seed = "user") => {
  const normalized = seed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  return `${normalized || "user"}${Date.now().toString().slice(-6)}`;
};

const signToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );

const sanitizeUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  googleId: user.googleId,
  avatar: user.avatar,
  fullname: user.fullname,
  gender: user.gender,
  favoriteStyles: user.favoriteStyles,
  favoriteColors: user.favoriteColors,
  role: user.role,
  phone_number: user.phone_number,
  authProviders: user.authProviders,
  isPhoneVerified: user.isPhoneVerified,
  isActive: user.isActive,
  city: user.city,
  dateOfBirth: user.dateOfBirth,
  height: user.height,
  weight: user.weight,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const issueAuthResponse = (res, user, statusCode, message) =>
  res.status(statusCode).json({
    success: true,
    message,
    data: {
      user: sanitizeUser(user),
      token: signToken(user),
    },
  });

export const sendRegisterOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email là bắt buộc" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email đã tồn tại" });
    }

    const otp = generateOTP();
    otpCache.set(`register_${normalizedEmail}`, otp);

    const emailResult = await sendOTPEmail(normalizedEmail, otp, "register");
    if (!emailResult.sent) {
      return res.status(500).json({
        success: false,
        message: "Không thể gửi OTP. " + emailResult.error,
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "OTP đã được gửi đến email" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { username, email, password, phone_number, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone_number);

    if (!username || !normalizedEmail || !password || !otp) {
      return res.status(400).json({
        success: false,
        message: "Username, email, mật khẩu và OTP là bắt buộc",
      });
    }

    const cachedOtp = otpCache.get(`register_${normalizedEmail}`);
    if (!cachedOtp || cachedOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không hợp lệ hoặc đã hết hạn",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email đã tồn tại",
      });
    }

    if (normalizedPhone) {
      const phoneExists = await User.findOne({ phone_number: normalizedPhone });

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "Số điện thoại đã tồn tại",
        });
      }
    }

    const user = await User.create({
      ...req.body,
      email: normalizedEmail,
      phone_number: normalizedPhone || undefined,
      authProviders: ["email"],
    });

    otpCache.del(`register_${normalizedEmail}`);

    return issueAuthResponse(res, user, 201, "Đăng ký thành công");
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
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
        message: "Email và mật khẩu là bắt buộc",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password",
    );

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
    }

    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    return issueAuthResponse(res, user, 200, "Đăng nhập thành công");
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Đã lấy được thông tin người dùng hiện tại",
    data: req.user,
  });
};

export const googleAuth = async (req, res) => {
  try {
    const { credential, fullname } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "GOOGLE_CLIENT_ID chưa được cấu hình",
      });
    }

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã xác thực Google",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({
        success: false,
        message: "Không thể xác minh email tài khoản Google",
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
        fullname: fullname || payload.name || "",
        authProviders: ["google"],
      });
    } else {
      user.googleId = user.googleId || payload.sub;
      user.email = user.email || normalizedEmail;
      user.fullname = user.fullname || fullname || payload.name || "";
      if (isGoogleAvatar(user.avatar)) {
        user.avatar = "";
      }
      user.authProviders = uniqueValues([
        ...(user.authProviders || []),
        "google",
      ]);
      await user.save();
    }

    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    return issueAuthResponse(res, user, 200, "Đăng nhập thành công");
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || "Đăng nhập thất bại",
    });
  }
};

export const firebasePhoneAuth = async (req, res) => {
  try {
    const { idToken, phoneNumber, fullname } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu Firebase ID token",
      });
    }

    // Xác thực Firebase ID Token
    let decodedToken;
    try {
      decodedToken = await verifyFirebaseToken(idToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Firebase không hợp lệ",
      });
    }

    // Lấy số điện thoại từ token hoặc từ request body
    const firebasePhone = decodedToken.phone_number || phoneNumber;
    const normalizedPhone = normalizePhone(firebasePhone);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy số điện thoại trong Firebase token",
      });
    }

    // Tìm hoặc tạo user
    let user = await User.findOne({ phone_number: normalizedPhone });

    if (!user) {
      // Tạo user mới với Firebase UID
      user = await User.create({
        username: generateUsername(normalizedPhone.slice(-4)),
        phone_number: normalizedPhone,
        fullname: fullname || "Người dùng",
        firebaseUid: decodedToken.uid,
        isPhoneVerified: true,
        authProviders: ["firebase_phone"],
      });
    } else {
      // Cập nhật user hiện có
      user.firebaseUid = user.firebaseUid || decodedToken.uid;
      user.isPhoneVerified = true;
      user.authProviders = uniqueValues([
        ...(user.authProviders || []),
        "firebase_phone",
      ]);

      if (fullname && !user.fullname) {
        user.fullname = fullname;
      }

      user.lastLoginAt = new Date();
      await user.save();
    }

    return issueAuthResponse(res, user, 200, "Đăng nhập thành công");
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Đăng nhập thất bại",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const {
      fullname,
      email,
      gender,
      favoriteStyles,
      favoriteColors,
      phone_number,
      avatar,
      city,
      dateOfBirth,
      height,
      weight,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    if (phone_number) {
      const normalizedPhone = normalizePhone(phone_number);
      const phoneExists = await User.findOne({
        phone_number: normalizedPhone,
        _id: { $ne: user._id },
      });

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "Số điện thoại đã tồn tại",
        });
      }

      user.phone_number = normalizedPhone;
    }

    if (fullname !== undefined) user.fullname = fullname;
    if (gender !== undefined) user.gender = gender;
    if (favoriteStyles !== undefined) user.favoriteStyles = favoriteStyles;
    if (favoriteColors !== undefined) user.favoriteColors = favoriteColors;
    if (avatar !== undefined) user.avatar = avatar;
    if (city !== undefined) user.city = city;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (height !== undefined) user.height = height;
    if (weight !== undefined) user.weight = weight;

    // Cho phép user đăng nhập bằng phone cập nhật email
    if (
      email !== undefined &&
      user.authProviders?.includes("firebase_phone") &&
      !user.authProviders?.includes("email") &&
      !user.authProviders?.includes("google")
    ) {
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail) {
        const emailExists = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id },
        });
        if (emailExists) {
          return res.status(409).json({
            success: false,
            message: "Email đã tồn tại",
          });
        }
        user.email = normalizedEmail;
      } else {
        user.email = undefined;
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công",
      data: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại và mật khẩu mới là bắt buộc",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản này chưa được đặt mật khẩu",
      });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const sendResetPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email là bắt buộc" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng với email này",
      });
    }

    if (!user.authProviders?.includes("email")) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản này không đăng nhập bằng email/mật khẩu",
      });
    }

    const otp = generateOTP();
    otpCache.set(`reset_${normalizedEmail}`, otp);

    const emailResult = await sendOTPEmail(
      normalizedEmail,
      otp,
      "reset_password",
    );
    if (!emailResult.sent) {
      return res.status(500).json({
        success: false,
        message: "Không thể gửi OTP. " + emailResult.error,
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "OTP đã được gửi đến email" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP và mật khẩu mới là bắt buộc",
      });
    }

    const cachedOtp = otpCache.get(`reset_${normalizedEmail}`);
    if (!cachedOtp || cachedOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không hợp lệ hoặc đã hết hạn",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    user.password = newPassword;
    await user.save();

    otpCache.del(`reset_${normalizedEmail}`);

    return res
      .status(200)
      .json({ success: true, message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
