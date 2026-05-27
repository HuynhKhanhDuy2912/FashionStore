import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const loginModes = [
  { key: "email", label: "Email" },
  { key: "google", label: "Google" },
  { key: "phone", label: "Số điện thoại" }
];

export default function LoginPage() {
  const { login, loginWithGoogle, requestPhoneOtp, verifyPhoneOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("email");
  const [emailForm, setEmailForm] = useState({
    email: "",
    password: ""
  });
  const [phoneForm, setPhoneForm] = useState({
    phone_number: "",
    otp: ""
  });
  const [phoneStep, setPhoneStep] = useState("request");
  const [otpPreview, setOtpPreview] = useState(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = location.state?.from || "/";

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

  const handleEmailLogin = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const authData = await login(emailForm);
      if (authData?.user?.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    resetMessages();

    try {
      if (!credentialResponse.credential) {
        throw new Error("Không nhận được token Google");
      }

      const authData = await loginWithGoogle(credentialResponse.credential);
      if (authData?.user?.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const response = await requestPhoneOtp({
        phone_number: phoneForm.phone_number
      });

      setPhoneStep("verify");
      setOtpPreview({
        maskedPhoneNumber: response.maskedPhoneNumber,
        demoOtp: response.demoOtp || "",
        demoMessage: response.demoMessage || "",
        expiresInSeconds: response.expiresInSeconds || 300,
        deliveryChannel: response.deliveryChannel || "demo_inbox"
      });
      setResendCountdown(response.resendCooldownSeconds || 60);
      setSuccess("Mã OTP đã được gửi tới khu vực mô phỏng. Nhập mã để tiếp tục đăng nhập.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const authData = await verifyPhoneOtp(phoneForm);
      if (authData?.user?.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-[70vh] bg-white px-4 py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden border border-gray-200 bg-white lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex flex-col justify-between overflow-hidden border-b border-gray-200 bg-black px-8 py-12 text-white lg:border-b-0 lg:border-r">
          <div className="absolute inset-0">
            <img
              src="/images/login.jpg"
              alt="Fashion Login"
              className="h-full w-full object-cover opacity-50 transition-transform duration-1000 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
          </div>

          <div className="relative z-10">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">
              FashionStore
            </p>
            <h1 className="text-3xl font-extrabold uppercase tracking-wider text-white">
              Chào mừng quay lại
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
              Tiếp tục hành trình mua sắm với trải nghiệm thời trang cá nhân hóa dành riêng cho bạn.
            </p>
          </div>

          <div className="relative z-10 mt-12 space-y-4">
            <div className="border border-white/20 bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-black/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">Gợi ý phù hợp</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">Hệ thống ưu tiên các sản phẩm theo hành vi, sở thích và lịch sử mua sắm của bạn.</p>
            </div>
            <div className="border border-white/20 bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-black/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">Mua sắm liền mạch</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">Theo dõi đơn hàng, danh sách yêu thích và giỏ hàng của bạn trên cùng một tài khoản.</p>
            </div>
            <div className="border border-white/20 bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-black/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">Thời trang hiện đại</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">Khám phá bộ sưu tập được tuyển chọn theo phong cách tối giản và dễ ứng dụng hằng ngày.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-10 md:px-10">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold uppercase tracking-widest text-black">
              Đăng nhập
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Chọn phương thức đăng nhập để tiếp tục mua sắm.
            </p>
          </div>

          <div className="mb-10 flex gap-2 border-b border-gray-200 pb-px">
            {loginModes.map((item) => (
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
            <form className="space-y-5" onSubmit={handleEmailLogin}>
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
                  placeholder="email@example.com"
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
                  placeholder="Nhập mật khẩu"
                />
              </div>

              <div className="pt-2">
                <button
                  className="w-full border border-black bg-black px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Đang đăng nhập..." : "Đăng nhập bằng email"}
                </button>
              </div>
            </form>
          ) : null}

          {mode === "google" ? (
            <div className="space-y-5">
              <div className="border border-gray-200 bg-gray-50 px-5 py-5 text-sm text-gray-600">
                Đăng nhập nhanh bằng Google để hệ thống tự tạo hoặc liên kết tài khoản cho bạn.
              </div>

              {googleEnabled ? (
                <div className="flex justify-center border border-gray-200 bg-white px-4 py-8">
                  <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={() => setError("Đăng nhập Google thất bại")}
                    theme="outline"
                    text="signin_with"
                    shape="rectangular"
                    size="large"
                  />
                </div>
              ) : (
                <div className="border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                  Chưa cấu hình `VITE_GOOGLE_CLIENT_ID`, nên chưa thể hiển thị nút đăng nhập Google.
                </div>
              )}
            </div>
          ) : null}

          {mode === "phone" ? (
            <form
              className="space-y-5"
              onSubmit={phoneStep === "request" ? handleRequestOtp : handleVerifyOtp}
            >
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
                  placeholder="Ví dụ: 0987654321"
                />
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
                  />
                </div>
              ) : null}

              {otpPreview ? (
                <div className="space-y-3 border border-dashed border-black bg-gray-50 px-4 py-4 text-sm text-black">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold uppercase tracking-widest">Tin nhắn mô phỏng</p>
                    <span className="text-[11px] uppercase tracking-widest text-gray-500">
                      {otpPreview.deliveryChannel === "demo_inbox" ? "Demo inbox" : "SMS"}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    Mã xác thực đã được gửi tới số <strong>{otpPreview.maskedPhoneNumber}</strong>.
                  </p>
                  <div className="border border-gray-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-widest text-gray-500">Nội dung tin nhắn</p>
                    <p className="mt-2 leading-6">{otpPreview.demoMessage || "OTP demo đã sẵn sàng để kiểm thử."}</p>
                    {otpPreview.demoOtp ? (
                      <p className="mt-3 text-lg font-extrabold tracking-[0.3em]">{otpPreview.demoOtp}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">
                    Mã có hiệu lực trong {Math.ceil((otpPreview.expiresInSeconds || 300) / 60)} phút.
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 border border-black bg-black px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={loading || (phoneStep === "request" && resendCountdown > 0)}
                >
                  {phoneStep === "request"
                    ? loading
                      ? "Đang gửi OTP..."
                      : resendCountdown > 0
                        ? `Gửi lại sau ${resendCountdown}s`
                        : "Gửi mã OTP"
                    : loading
                      ? "Đang xác thực..."
                      : "Xác thực và đăng nhập"}
                </button>

                {phoneStep === "verify" ? (
                  <button
                    className="border border-gray-300 bg-white px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-black transition hover:border-black"
                    type="button"
                    onClick={() => {
                      setPhoneStep("request");
                      setPhoneForm((current) => ({ ...current, otp: "" }));
                      setOtpPreview(null);
                      resetMessages();
                    }}
                  >
                    Chỉnh số
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          <div className="mt-8 border-t border-gray-200 pt-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Chưa có tài khoản?
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="ml-2 border-none bg-transparent p-0 font-extrabold text-black hover:underline"
              >
                Đăng ký ngay
              </button>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
