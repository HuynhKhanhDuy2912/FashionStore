import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api.js";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request"); // request | reset
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const resetMessages = () => {
    setError("");
    setSuccess("");
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

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!formData.email) {
      setError("Vui lòng nhập email");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/auth/send-reset-otp", {
        method: "POST",
        body: { email: formData.email }
      });
      setStep("reset");
      setResendCountdown(60);
      setSuccess("Mã OTP đã được gửi đến email của bạn.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!formData.otp || !formData.newPassword || !formData.confirmPassword) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: {
          email: formData.email,
          otp: formData.otp,
          newPassword: formData.newPassword
        }
      });
      setSuccess("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
      setStep("success");
    } catch (err) {
      setError(err.message);
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
              src="/images/login.jpg"
              alt="Fashion"
              className="h-full w-full object-cover opacity-60 transition-transform duration-1000 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
          </div>

          <div className="relative z-10 mt-auto">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">
              FashionStore
            </p>
            <h1 className="text-3xl font-extrabold uppercase tracking-wider text-white">
              Khôi phục mật khẩu
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
              Lấy lại quyền truy cập vào tài khoản của bạn để tiếp tục trải nghiệm mua sắm.
            </p>
          </div>
        </div>

        <div className="px-8 py-10 md:px-10 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold uppercase tracking-widest text-black">
              Quên mật khẩu
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {step === "request"
                ? "Nhập email của bạn để nhận mã xác minh."
                : step === "reset"
                  ? "Nhập mã OTP và mật khẩu mới để khôi phục tài khoản."
                  : "Mật khẩu của bạn đã được đặt lại thành công."}
            </p>
          </div>

          {error ? (
            <p className="mb-5 border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {success && step !== "success" ? (
            <p className="mb-5 border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {success}
            </p>
          ) : null}

          {step === "request" ? (
            <form className="space-y-5" onSubmit={handleRequestOtp}>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Email
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="abc@gmail.com"
                />
              </div>

              <div className="pt-2">
                <button
                  className="w-full border border-black bg-black px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Đang gửi OTP..." : "Nhận mã xác nhận"}
                </button>
              </div>
            </form>
          ) : step === "reset" ? (
            <form className="space-y-5" onSubmit={handleResetPassword}>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Email
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  value={formData.email}
                  disabled
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Mã OTP
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  value={formData.otp}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, otp: event.target.value }))
                  }
                  placeholder="Nhập mã 6 số từ email"
                  maxLength={6}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Mật khẩu mới
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  type="password"
                  value={formData.newPassword}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-black">
                  Xác nhận mật khẩu
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition-all focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 border border-black bg-black px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                </button>

                <button
                  className="border border-gray-300 bg-white px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-black transition hover:border-black disabled:opacity-50"
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading || resendCountdown > 0}
                >
                  {resendCountdown > 0 ? `Gửi lại (${resendCountdown}s)` : "Gửi lại OTP"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold">Thành công!</h3>
              <p className="mb-8 text-gray-600">Mật khẩu của bạn đã được cập nhật thành công.</p>
              <button
                onClick={() => navigate("/login")}
                className="w-full border border-black bg-black px-6 py-4 text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-gray-800"
              >
                Đăng nhập ngay
              </button>
            </div>
          )}

          <div className="mt-8 border-t border-gray-200 pt-6 text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-black hover:underline"
            >
              Quay lại đăng nhập
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
