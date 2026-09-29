import {
  sendRegisterOTPService,
  registerService,
  loginService,
  googleAuthService,
  firebasePhoneAuthService,
  updateProfileService,
  changePasswordService,
  sendResetPasswordOTPService,
  resetPasswordService,
  sanitizeUser,
} from "../services/auth.service.js";

export const sendRegisterOTP = async (req, res) => {
  try {
    const result = await sendRegisterOTPService(req.body.email);

    return res
      .status(200)
      .json({ success: true, message: result.message });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const register = async (req, res) => {
  try {
    const result = await registerService(req.body);

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginService(email, password);

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
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
    const result = await googleAuthService(credential, fullname);

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Đăng nhập thất bại",
    });
  }
};

export const firebasePhoneAuth = async (req, res) => {
  try {
    const { idToken, phoneNumber, fullname } = req.body;
    const result = await firebasePhoneAuthService(idToken, phoneNumber, fullname);

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Đăng nhập thất bại",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const updatedUser = await updateProfileService(req.user._id, req.body);

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await changePasswordService(req.user._id, currentPassword, newPassword);

    return res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const sendResetPasswordOTP = async (req, res) => {
  try {
    const result = await sendResetPasswordOTPService(req.body.email);

    return res
      .status(200)
      .json({ success: true, message: result.message });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    await resetPasswordService(email, otp, newPassword);

    return res
      .status(200)
      .json({ success: true, message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};
