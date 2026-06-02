import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useFirebasePhone } from "../hooks/useFirebasePhone.js";
import { apiRequest } from "../lib/api.js";

const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const registerModes = [
  { key: "email", label: "Email" },
  { key: "google", label: "Google" },
  { key: "phone", label: "Số điện thoại" }
];

export default function RegisterPage() {
  const { register, loginWithGoogle, loginWithFirebasePhone } = useAuth();
  const navigate = useNavigate();

  // Firebase Phone Authentication Hook
  const { sendOTP, verifyOTP, resetState: resetFirebase, loading: firebaseLoading, error: firebaseError } = useFirebasePhone();

  const [mode, setMode] = useState("email");
  const [emailStep, setEmailStep] = useState("request"); // request | verify
  const [emailForm, setEmailForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    otp: ""
  });
  const [phoneForm, setPhoneForm] = useState({
    fullname: "",
    phone_number: "",
    otp: ""
  });
  const [phoneStep, setPhoneStep] = useState("request");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    resetMessages();
  };

  useEffect(() => {
    if (resendCountdown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  const handleRequestEmailOtp = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!emailForm.email || !emailForm.password || !emailForm.confirmPassword) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (emailForm.password !== emailForm.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (emailForm.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/auth/send-register-otp", {
        method: "POST",
        body: { email: emailForm.email }
      });
      setEmailStep("verify");
      setResendCountdown(60);
      setSuccess("Mã OTP đã được gửi đến email của bạn.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      await register({
        username: emailForm.email.split("@")[0],
        email: emailForm.email,
        password: emailForm.password,
        otp: emailForm.otp
      });
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async (credentialResponse) => {
    resetMessages();

    try {
      if (!credentialResponse.credential) {
        throw new Error("Không nhận được token Google");
      }

      await loginWithGoogle(credentialResponse.credential);
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      // Chuẩn hóa số điện thoại: Nếu bắt đầu bằng 0, thay bằng +84
      let formattedPhone = phoneForm.phone_number.trim();
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+84' + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+84' + formattedPhone;
      }

      // Gửi OTP THẬT qua Firebase
      await sendOTP(formattedPhone);

      // Chuyển sang bước nhập OTP
      setPhoneStep("verify");
      setPhoneForm((current) => ({ ...current, phone_number: formattedPhone }));
      setResendCountdown(60); // Chờ 60 giây trước khi gửi lại
      setSuccess("Mã OTP đã được gửi đến số điện thoại của bạn qua SMS. Vui lòng kiểm tra tin nhắn.");
    } catch (submitError) {
      setError(submitError.message || firebaseError);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      // Xác thực OTP với Firebase
      const firebaseResult = await verifyOTP(phoneForm.otp);

      // Gửi Firebase ID Token lên backend để tạo tài khoản
      await loginWithFirebasePhone({
        idToken: firebaseResult.user.idToken,
        phoneNumber: firebaseResult.user.phoneNumber,
        fullname: phoneForm.fullname
      });

      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message || firebaseError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-[70vh] bg-white px-4 py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden border border-gray-200 bg-white lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex flex-col justify-between overflow-hidden border-b border-gray-200 bg-gray-50 px-8 py-12 lg:border-b-0 lg:border-r">
          <div className="absolute inset-0">
            <img
              src="/images/register.jpg"
              alt="Fashion Register"
              className="h-full w-full object-cover opacity-60 transition-transform duration-1000 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
          </div>

          <div className="relative z-10 mt-auto">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">
              FashionStore
            </p>
            <h1 className="text-3xl font-extrabold uppercase tracking-wider text-white">
              Tạo tài khoản mới
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
              Bắt đầu hành trình mua sắm với một tài khoản gọn gàng, dễ dùng và đồng bộ trên toàn bộ hệ thống.
            </p>
          </div>

          <div className="relative z-10 mt-12 space-y-4">
            <div className="border border-white/20 bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-black/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">Cá nhân hóa tốt hơn</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">Lưu lại hành vi, sở thích và sản phẩm yêu thích để hệ thống gợi ý chính xác hơn.</p>
            </div>
            <div className="border border-white/20 bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-black/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">Quản lý mua sắm dễ dàng</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">Theo dõi đơn hàng, sản phẩm yêu thích và lịch sử tương tác của bạn trong cùng một nơi.</p>
            </div>
            <div className="border border-white/20 bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-black/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">Trải nghiệm liền mạch</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">Đăng nhập nhanh bằng nhiều phương thức nhưng vẫn dùng chung một hệ thống tài khoản.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-10 md:px-10">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold uppercase tracking-widest text-black">
              Đăng ký
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Tạo tài khoản để nhận ưu đãi và mua sắm dễ dàng hơn
            </p>
          </div>

          <div className="mb-10 flex gap-2 border-b border-gray-200 pb-px">
            {registerModes.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleModeChange(item.key)}
                className={`relative px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${mode === item.key
                  ? "text-black"
                  : "text-gray-400 hover:text-black"
                  }`}
              >
                {item.label}
                {mode === item.key && (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full bg-black" />
                )}
              </button>
            ))}
          </div>

          {error ? (
            <p className="mb-5 border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="mb-5 border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {success}
            </p>
          ) : null}

          {mode === "email" ? (
            <form className="space-y-5" onSubmit={emailStep === "request" ? handleRequestEmailOtp : handleEmailRegister}>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Email
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  value={emailForm.email}
                  onChange={(event) =>
                    setEmailForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="abc@gmail.com"
                  disabled={emailStep === "verify"}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Mật khẩu
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  type="password"
                  value={emailForm.password}
                  onChange={(event) =>
                    setEmailForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Ít nhất 6 ký tự"
                  disabled={emailStep === "verify"}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Xác nhận mật khẩu
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  type="password"
                  value={emailForm.confirmPassword}
                  onChange={(event) =>
                    setEmailForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value
                    }))
                  }
                  placeholder="Nhập lại mật khẩu"
                  disabled={emailStep === "verify"}
                />
              </div>

              {emailStep === "verify" ? (
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                    Mã OTP
                  </label>
                  <input
                    className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                    value={emailForm.otp}
                    onChange={(event) =>
                      setEmailForm((current) => ({ ...current, otp: event.target.value }))
                    }
                    placeholder="Nhập mã 6 số từ email"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Mã OTP đã được gửi đến email của bạn.
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 border border-black bg-black px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={loading || (emailStep === "request" && resendCountdown > 0)}
                >
                  {emailStep === "request"
                    ? loading
                      ? "Đang gửi OTP..."
                      : resendCountdown > 0
                        ? `Gửi lại sau ${resendCountdown}s`
                        : "Nhận mã xác nhận"
                    : loading
                      ? "Đang tạo tài khoản..."
                      : "Xác thực và đăng ký"}
                </button>

                {emailStep === "verify" ? (
                  <button
                    className="border border-gray-300 bg-white px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-black transition hover:border-black"
                    type="button"
                    onClick={() => {
                      setEmailStep("request");
                      setEmailForm((current) => ({ ...current, otp: "" }));
                      resetMessages();
                    }}
                  >
                    Đổi email
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          {mode === "google" ? (
            <div className="space-y-5">
              <div className="border border-gray-200 bg-gray-50 px-5 py-5 text-sm text-gray-600">
                Tạo tài khoản chỉ với một lần xác nhận Google. Nếu email đã tồn tại, hệ thống sẽ liên kết để tránh tạo trùng hồ sơ.
              </div>

              {googleEnabled ? (
                <div className="flex justify-center border border-gray-200 bg-white px-4 py-8">
                  <GoogleLogin
                    onSuccess={handleGoogleRegister}
                    onError={() => setError("Đăng ký Google thất bại")}
                    theme="outline"
                    text="signup_with"
                    shape="rectangular"
                    size="large"
                  />
                </div>
              ) : (
                <div className="border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                  Chưa cấu hình `VITE_GOOGLE_CLIENT_ID`, nên chưa thể hiển thị nút đăng ký Google.
                </div>
              )}
            </div>
          ) : null}

          {mode === "phone" ? (
            <form
              className="space-y-5"
              onSubmit={phoneStep === "request" ? handleRequestOtp : handleVerifyOtp}
            >
              {/* Container cho Invisible reCAPTCHA - KHÔNG XÓA */}
              <div id="recaptcha-container"></div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Họ và tên
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  value={phoneForm.fullname}
                  onChange={(event) =>
                    setPhoneForm((current) => ({ ...current, fullname: event.target.value }))
                  }
                  placeholder="Nguyễn Văn A"
                  disabled={phoneStep === "verify"}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Số điện thoại
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  value={phoneForm.phone_number}
                  onChange={(event) =>
                    setPhoneForm((current) => ({ ...current, phone_number: event.target.value }))
                  }
                  placeholder="Ví dụ: 0987654321 hoặc +84987654321"
                  disabled={phoneStep === "verify"}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Nhập số điện thoại Việt Nam. Hệ thống sẽ tự thêm mã +84 nếu bạn bắt đầu bằng số 0.
                </p>
              </div>

              {phoneStep === "verify" ? (
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                    Mã OTP
                  </label>
                  <input
                    className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                    value={phoneForm.otp}
                    onChange={(event) =>
                      setPhoneForm((current) => ({ ...current, otp: event.target.value }))
                    }
                    placeholder="Nhập mã 6 số"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Mã OTP đã được gửi qua SMS đến số điện thoại của bạn.
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 border border-black bg-black px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={loading || firebaseLoading || (phoneStep === "request" && resendCountdown > 0)}
                >
                  {phoneStep === "request"
                    ? loading || firebaseLoading
                      ? "Đang gửi OTP..."
                      : resendCountdown > 0
                        ? `Gửi lại sau ${resendCountdown}s`
                        : "Gửi mã OTP"
                    : loading || firebaseLoading
                      ? "Đang xác thực..."
                      : "Xác thực và đăng ký"}
                </button>

                {phoneStep === "verify" ? (
                  <button
                    className="border border-gray-300 bg-white px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-black transition hover:border-black"
                    type="button"
                    onClick={() => {
                      setPhoneStep("request");
                      setPhoneForm((current) => ({ ...current, phone_number: "", otp: "" }));
                      resetFirebase();
                      resetMessages();
                    }}
                  >
                    Đổi số
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          <div className="mt-8 border-t border-gray-200 pt-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Đã có tài khoản?
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="ml-2 border-none bg-transparent p-0 font-extrabold text-black hover:underline"
              >
                Đăng nhập ngay
              </button>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
