import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { verifyFirebaseToken } from "../config/firebase.js";
import NodeCache from "node-cache";
import { sendOTPEmail } from "./mail.service.js";

const otpCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const normalizeEmail = (email = "") => email.trim().toLowerCase();
export const normalizePhone = (phoneNumber = "") =>
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

export const signToken = (user) =>
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

export const sanitizeUser = (user) => ({
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

export const sendRegisterOTPService = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw Object.assign(new Error("Email là bắt buộc"), { statusCode: 400 });
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw Object.assign(new Error("Email đã tồn tại"), { statusCode: 409 });
  }

  const otp = generateOTP();
  otpCache.set(`register_${normalizedEmail}`, otp);

  const emailResult = await sendOTPEmail(normalizedEmail, otp, "register");
  if (!emailResult.sent) {
    throw Object.assign(
      new Error("Không thể gửi OTP. " + emailResult.error),
      { statusCode: 500 },
    );
  }

  return { message: "OTP đã được gửi đến email" };
};

export const registerService = async ({
  username,
  email,
  password,
  phone_number,
  otp,
  ...rest
}) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone_number || "");

  if (!username || !normalizedEmail || !password || !otp) {
    throw Object.assign(
      new Error("Username, email, mật khẩu và OTP là bắt buộc"),
      { statusCode: 400 },
    );
  }

  const cachedOtp = otpCache.get(`register_${normalizedEmail}`);
  if (!cachedOtp || cachedOtp !== otp) {
    throw Object.assign(
      new Error("Mã OTP không hợp lệ hoặc đã hết hạn"),
      { statusCode: 400 },
    );
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw Object.assign(new Error("Email đã tồn tại"), { statusCode: 409 });
  }

  if (normalizedPhone) {
    const phoneExists = await User.findOne({ phone_number: normalizedPhone });
    if (phoneExists) {
      throw Object.assign(new Error("Số điện thoại đã tồn tại"), {
        statusCode: 409,
      });
    }
  }

  const user = await User.create({
    ...rest,
    username,
    email: normalizedEmail,
    password,
    phone_number: normalizedPhone || undefined,
    authProviders: ["email"],
  });

  otpCache.del(`register_${normalizedEmail}`);

  return { user: sanitizeUser(user), token: signToken(user) };
};

export const loginService = async (email, password) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw Object.assign(
      new Error("Email và mật khẩu là bắt buộc"),
      { statusCode: 400 },
    );
  }

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password",
  );

  if (!user || !user.password) {
    throw Object.assign(
      new Error("Email hoặc mật khẩu không chính xác"),
      { statusCode: 401 },
    );
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw Object.assign(
      new Error("Email hoặc mật khẩu không chính xác"),
      { statusCode: 401 },
    );
  }

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  return { user: sanitizeUser(user), token: signToken(user) };
};

export const googleAuthService = async (credential, fullname) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw Object.assign(
      new Error("GOOGLE_CLIENT_ID chưa được cấu hình"),
      { statusCode: 500 },
    );
  }

  if (!credential) {
    throw Object.assign(new Error("Thiếu mã xác thực Google"), {
      statusCode: 400,
    });
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw Object.assign(
      new Error("Không thể xác minh email tài khoản Google"),
      { statusCode: 400 },
    );
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

  return { user: sanitizeUser(user), token: signToken(user) };
};

export const firebasePhoneAuthService = async (
  idToken,
  phoneNumber,
  fullname,
) => {
  if (!idToken) {
    throw Object.assign(new Error("Thiếu Firebase ID token"), {
      statusCode: 400,
    });
  }

  let decodedToken;
  try {
    decodedToken = await verifyFirebaseToken(idToken);
  } catch {
    throw Object.assign(new Error("Firebase không hợp lệ"), {
      statusCode: 401,
    });
  }

  const firebasePhone = decodedToken.phone_number || phoneNumber;
  const normalizedPhone = normalizePhone(firebasePhone || "");

  if (!normalizedPhone) {
    throw Object.assign(
      new Error("Không tìm thấy số điện thoại trong Firebase token"),
      { statusCode: 400 },
    );
  }

  let user = await User.findOne({ phone_number: normalizedPhone });

  if (!user) {
    user = await User.create({
      username: generateUsername(normalizedPhone.slice(-4)),
      phone_number: normalizedPhone,
      fullname: fullname || "Người dùng",
      firebaseUid: decodedToken.uid,
      isPhoneVerified: true,
      authProviders: ["firebase_phone"],
    });
  } else {
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

  return { user: sanitizeUser(user), token: signToken(user) };
};

export const updateProfileService = async (userId, profileData) => {
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
  } = profileData;

  const user = await User.findById(userId);

  if (!user) {
    throw Object.assign(new Error("Không tìm thấy người dùng"), {
      statusCode: 404,
    });
  }

  if (phone_number) {
    const normalizedPhone = normalizePhone(phone_number);
    const phoneExists = await User.findOne({
      phone_number: normalizedPhone,
      _id: { $ne: user._id },
    });

    if (phoneExists) {
      throw Object.assign(new Error("Số điện thoại đã tồn tại"), {
        statusCode: 409,
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
        throw Object.assign(new Error("Email đã tồn tại"), {
          statusCode: 409,
        });
      }
      user.email = normalizedEmail;
    } else {
      user.email = undefined;
    }
  }

  await user.save();

  return sanitizeUser(user);
};

export const changePasswordService = async (
  userId,
  currentPassword,
  newPassword,
) => {
  if (!currentPassword || !newPassword) {
    throw Object.assign(
      new Error("Mật khẩu hiện tại và mật khẩu mới là bắt buộc"),
      { statusCode: 400 },
    );
  }

  if (newPassword.length < 6) {
    throw Object.assign(
      new Error("Mật khẩu mới phải có ít nhất 6 ký tự"),
      { statusCode: 400 },
    );
  }

  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw Object.assign(new Error("Không tìm thấy người dùng"), {
      statusCode: 404,
    });
  }

  if (!user.password) {
    throw Object.assign(
      new Error("Tài khoản này chưa được đặt mật khẩu"),
      { statusCode: 400 },
    );
  }

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw Object.assign(
      new Error("Mật khẩu hiện tại không chính xác"),
      { statusCode: 401 },
    );
  }

  user.password = newPassword;
  await user.save();
};

export const sendResetPasswordOTPService = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw Object.assign(new Error("Email là bắt buộc"), { statusCode: 400 });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw Object.assign(
      new Error("Không tìm thấy người dùng với email này"),
      { statusCode: 404 },
    );
  }

  if (!user.authProviders?.includes("email")) {
    throw Object.assign(
      new Error("Tài khoản này không đăng nhập bằng email/mật khẩu"),
      { statusCode: 400 },
    );
  }

  const otp = generateOTP();
  otpCache.set(`reset_${normalizedEmail}`, otp);

  const emailResult = await sendOTPEmail(
    normalizedEmail,
    otp,
    "reset_password",
  );
  if (!emailResult.sent) {
    throw Object.assign(
      new Error("Không thể gửi OTP. " + emailResult.error),
      { statusCode: 500 },
    );
  }

  return { message: "OTP đã được gửi đến email" };
};

export const resetPasswordService = async (email, otp, newPassword) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp || !newPassword) {
    throw Object.assign(
      new Error("Email, OTP và mật khẩu mới là bắt buộc"),
      { statusCode: 400 },
    );
  }

  const cachedOtp = otpCache.get(`reset_${normalizedEmail}`);
  if (!cachedOtp || cachedOtp !== otp) {
    throw Object.assign(
      new Error("Mã OTP không hợp lệ hoặc đã hết hạn"),
      { statusCode: 400 },
    );
  }

  if (newPassword.length < 6) {
    throw Object.assign(
      new Error("Mật khẩu mới phải có ít nhất 6 ký tự"),
      { statusCode: 400 },
    );
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw Object.assign(new Error("Không tìm thấy người dùng"), {
      statusCode: 404,
    });
  }

  user.password = newPassword;
  await user.save();

  otpCache.del(`reset_${normalizedEmail}`);
};
