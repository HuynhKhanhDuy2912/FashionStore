import { useEffect, useState } from "react";
import { X, Copy, Check, ArrowRight, BadgePercent, Gift, Ticket, Truck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const formatCurrency = (v = 0) => `${Number(v).toLocaleString("vi-VN")}đ`;

const TYPE_ICONS = {
  percentage: BadgePercent,
  fixed_amount: Ticket,
  free_shipping: Truck
};

const getDiscountLabel = (coupon) => {
  switch (coupon.discountType) {
    case "percentage":
      return `Giảm ${coupon.discountValue}%${coupon.maxDiscountAmount ? ` (tối đa ${formatCurrency(coupon.maxDiscountAmount)})` : ""}`;
    case "fixed_amount":
      return `Giảm ${formatCurrency(coupon.discountValue)}`;
    case "free_shipping":
      if (coupon.discountValue > 0) {
        return `Giảm ${formatCurrency(coupon.discountValue)} phí vận chuyển`;
      }
      return "Miễn phí vận chuyển";
    default:
      return "";
  }
};

const getSubLabel = (coupon) => {
  if (coupon.minOrderAmount > 0) {
    return `Đơn từ ${formatCurrency(coupon.minOrderAmount)}`;
  }
  return "Áp dụng mọi đơn";
};

export default function CouponPopup() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [receivedCodes, setReceivedCodes] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);
  const isAuthenticated = Boolean(token);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAndShow();
    }, 2000);

    return () => clearTimeout(timer);
  }, [token]);

  const loadAndShow = async () => {
    try {
      let data = [];

      if (token) {
        const [availableResponse, savedResponse] = await Promise.all([
          apiRequest("/coupons/available", { token }),
          apiRequest("/coupons/saved", { token })
        ]);

        const availableCoupons = availableResponse.data || [];
        const savedCodes = (savedResponse.data || []).map((c) => c.code);
        setReceivedCodes(savedCodes);

        data = availableCoupons.filter((c) => !savedCodes.includes(c.code));
      } else {
        const publicResponse = await apiRequest("/coupons/public");
        data = publicResponse.data || [];
        setReceivedCodes([]);
      }

      if (data.length > 0) {
        setCoupons(data.slice(0, 4));
        setShow(true);
      } else {
        setCoupons([]);
        setShow(false);
      }
    } catch (err) {
      console.error("Failed to load popup coupons:", err);
    }
  };

  const handleClose = () => {
    setShow(false);
  };

  const handleCopy = async (code) => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { from: `${location.pathname}${location.search}` }
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const input = document.createElement("input");
      input.value = code;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }

    await apiRequest("/coupons/save", {
      method: "POST",
      token,
      body: { code }
    });

    setReceivedCodes((current) =>
      current.includes(code) ? current : [...current, code]
    );
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!show || coupons.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: "fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Header */}
        <div className="relative border-b border-white/10 bg-[#ee3b00] px-6 py-6 text-white">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-sm grid h-9 w-9 place-items-center border border-white text-white transition hover:bg-white hover:text-black"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="flex items-center gap-2 text-[15px] font-bold uppercase text-white">
            <Gift className="h-4 w-4" strokeWidth={1.5} />
            FashionStore
          </p>
          <h2 className="mt-3 pr-10 text-2xl font-bold tracking-tight">
            Ưu đãi dành cho bạn
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white">
            Lưu mã vào ví voucher và dùng khi thanh toán.
          </p>
        </div>

        {/* Coupons */}
        <div className="max-h-[50vh] space-y-3 overflow-y-auto bg-white p-4 sm:p-5">
          {coupons.map((coupon) => {
            const Icon = TYPE_ICONS[coupon.discountType] || Tag;
            const isSaved = receivedCodes.includes(coupon.code);
            const isFreeShipping = coupon.discountType === "free_shipping";
            const toneClass = isFreeShipping
              ? "bg-blue-50 text-blue-700"
              : "bg-emerald-50 text-emerald-700";

            return (
              <div
                key={coupon._id}
                className={`relative flex overflow-hidden border border-gray-200 ${isFreeShipping ? "bg-blue-50/60" : "bg-emerald-50/60"}`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 p-4">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center my-auto ${toneClass}`}>
                    <Icon className="h-7 w-7" strokeWidth={1.5} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-base font-black tracking-tight text-gray-950">
                      {coupon.code}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {getDiscountLabel(coupon)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{getSubLabel(coupon)}</p>
                  </div>
                </div>

                <div className="relative flex w-0 flex-col items-center justify-center border-l-2 border-dashed border-white">
                  <div className="absolute -top-3 h-6 w-6 rounded-full bg-white shadow-inner" />
                  <div className="absolute -bottom-3 h-6 w-6 rounded-full bg-white shadow-inner" />
                </div>

                <div className="flex w-[112px] shrink-0 items-center justify-center p-3">
                  <button
                    type="button"
                    disabled={isSaved}
                    onClick={() => handleCopy(coupon.code)}
                    className={`inline-flex h-10 w-full items-center justify-center gap-2 border px-3 text-[11px] font-bold uppercase tracking-wider transition ${isSaved
                      ? "cursor-not-allowed border-gray-200 bg-white text-gray-400"
                      : "border-gray-600 bg-white text-black hover:bg-black hover:text-white"
                      }`}
                  >
                    {isSaved || copiedCode === coupon.code ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Đã lưu
                      </>
                    ) : !isAuthenticated ? (
                      "Lưu mã"
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Lưu mã
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-white p-5 text-center">
          <Link
            to={isAuthenticated ? "/profile?tab=coupons" : "/login"}
            state={isAuthenticated ? undefined : { from: "/profile?tab=coupons" }}
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-sm font-semibold text-black transition hover:gap-3"
          >
            Xem tất cả trong Ví Voucher
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
