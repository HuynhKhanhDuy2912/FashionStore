import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const registerModes = [
  { key: "email", label: "Email" },
  { key: "google", label: "Google" },
  { key: "phone", label: "Số điện thoại" }
];

export default function RegisterPage() {
  const { register, loginWithGoogle, requestPhoneOtp, verifyPhoneOtp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("email");
  const [emailForm, setEmailForm] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [phoneForm, setPhoneForm] = useState({
    full_name: "",
    phone_number: "",
    otp: ""
  });
  const [phoneStep, setPhoneStep] = useState("request");
  const [otpPreview, setOtpPreview] = useState(null);
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

  const handleEmailRegister = async (event) => {
    event.preventDefault();
    resetMessages();

    if (emailForm.password !== emailForm.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    try {
      await register({
        username: emailForm.email.split("@")[0],
        email: emailForm.email,
        password: emailForm.password
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
      const response = await requestPhoneOtp({
        full_name: phoneForm.full_name,
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
      setSuccess("Mã OTP đã được gửi tới khu vực mô phỏng. Nhập mã để hoàn tất đăng ký.");
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
      await verifyPhoneOtp(phoneForm);
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-[70vh] bg-white px-4 py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden border border-gray-200 bg-white lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border-b border-gray-200 bg-gray-50 px-8 py-10 lg:border-b-0 lg:border-r">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-gray-500">
            FashionStore
          </p>
          <h1 className="text-3xl font-extrabold uppercase tracking-wider text-black">
            Tạo tài khoản mới
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-gray-600">
            Bắt đầu hành trình mua sắm với một tài khoản gọn gàng, dễ dùng và đồng bộ trên toàn bộ hệ thống.
          </p>

          <div className="mt-10 space-y-4 text-sm text-gray-600">
            <div className="border border-gray-200 bg-white px-4 py-4">
              <p className="font-bold uppercase tracking-widest text-black">Cá nhân hóa tốt hơn</p>
              <p className="mt-2">Lưu lại hành vi, sở thích và sản phẩm yêu thích để hệ thống gợi ý chính xác hơn.</p>
            </div>
            <div className="border border-gray-200 bg-white px-4 py-4">
              <p className="font-bold uppercase tracking-widest text-black">Quản lý mua sắm dễ dàng</p>
              <p className="mt-2">Theo dõi đơn hàng, wishlist và lịch sử tương tác của bạn trong cùng một nơi.</p>
            </div>
            <div className="border border-gray-200 bg-white px-4 py-4">
              <p className="font-bold uppercase tracking-widest text-black">Trải nghiệm liền mạch</p>
              <p className="mt-2">Đăng nhập nhanh bằng nhiều phương thức nhưng vẫn dùng chung một hệ thống tài khoản.</p>
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

          <div className="mb-8 grid grid-cols-3 border border-gray-200 p-1">
            {registerModes.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleModeChange(item.key)}
                className={`px-3 py-3 text-xs font-bold uppercase tracking-widest transition ${
                  mode === item.key
                    ? "bg-black text-white"
                    : "bg-white text-gray-500 hover:text-black"
                }`}
              >
                {item.label}
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
            <form className="space-y-5" onSubmit={handleEmailRegister}>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Email
                </label>
                <input
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  value={emailForm.email}
                  onChange={(event) =>
                    setEmailForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="abc@gmail.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Mật khẩu
                </label>
                <input
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  type="password"
                  value={emailForm.password}
                  onChange={(event) =>
                    setEmailForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Xác nhận mật khẩu
                </label>
                <input
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  type="password"
                  value={emailForm.confirmPassword}
                  onChange={(event) =>
                    setEmailForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value
                    }))
                  }
                  placeholder="Nhập lại mật khẩu"
                />
              </div>

              <button
                className="w-full border border-black bg-black px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={loading}
              >
                {loading ? "Đang tạo tài khoản..." : "Đăng ký bằng email"}
              </button>
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
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Họ và tên
                </label>
                <input
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  value={phoneForm.full_name}
                  onChange={(event) =>
                    setPhoneForm((current) => ({ ...current, full_name: event.target.value }))
                  }
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Số điện thoại
                </label>
                <input
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
                  value={phoneForm.phone_number}
                  onChange={(event) =>
                    setPhoneForm((current) => ({ ...current, phone_number: event.target.value }))
                  }
                  placeholder="0987654321"
                />
              </div>

              {phoneStep === "verify" ? (
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                    Mã OTP
                  </label>
                  <input
                    className="w-full border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-black"
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

              <div className="flex gap-3">
                <button
                  className="flex-1 border border-black bg-black px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={loading || (phoneStep === "request" && resendCountdown > 0)}
                >
                  {phoneStep === "request"
                    ? loading
                      ? "Đang gửi OTP..."
                      : resendCountdown > 0
                        ? `Gửi lại sau ${resendCountdown}s`
                        : "Gửi OTP đăng ký"
                    : loading
                      ? "Đang xác thực..."
                      : "Xác thực và tạo tài khoản"}
                </button>

                {phoneStep === "verify" ? (
                  <button
                    className="border border-gray-300 bg-white px-5 py-3 text-sm font-bold uppercase tracking-widest text-black transition hover:border-black"
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
