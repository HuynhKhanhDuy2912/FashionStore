import { useEffect, useState } from "react";
import { Gift, X, Copy, Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api.js";

const RECEIVED_KEY = "fs-received-coupons";

const formatCurrency = (v = 0) => `${Number(v).toLocaleString("vi-VN")}đ`;

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

export default function CouponPopup() {
  const [show, setShow] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAndShow();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const loadAndShow = async () => {
    try {
      const res = await apiRequest("/coupons/public");
      let data = res.data || [];

      // Filter out received coupons
      const receivedCouponsStr = localStorage.getItem(RECEIVED_KEY);
      const receivedCoupons = receivedCouponsStr ? JSON.parse(receivedCouponsStr) : [];
      
      data = data.filter(c => !receivedCoupons.includes(c.code));

      if (data.length > 0) {
        setCoupons(data.slice(0, 4));
        setShow(true);
      }
    } catch (err) {
      console.error("Failed to load popup coupons:", err);
    }
  };

  const handleClose = () => {
    setShow(false);
  };

  const handleCopy = async (code) => {
    const markAsReceived = () => {
      const receivedCouponsStr = localStorage.getItem(RECEIVED_KEY);
      const receivedCoupons = receivedCouponsStr ? JSON.parse(receivedCouponsStr) : [];
      if (!receivedCoupons.includes(code)) {
        receivedCoupons.push(code);
        localStorage.setItem(RECEIVED_KEY, JSON.stringify(receivedCoupons));
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    };

    try {
      await navigator.clipboard.writeText(code);
      markAsReceived();
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = code;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      markAsReceived();
    }
  };

  if (!show || coupons.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: "fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 px-6 pb-8 pt-10 text-center text-white">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-white backdrop-blur-sm transition hover:bg-black/20"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 shadow-inner backdrop-blur-md">
            <Gift className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">ƯU ĐÃI DÀNH CHO BẠN</h2>
          <p className="mt-2 text-sm font-medium text-white/90">
            Lưu ngay mã giảm giá để mua sắm tiết kiệm hơn!
          </p>
        </div>

        {/* Coupons */}
        <div className="max-h-[45vh] space-y-3 overflow-y-auto bg-slate-50 p-6">
          {coupons.map((coupon) => (
            <div
              key={coupon._id}
              className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md"
            >
              {/* Decorative left accent */}
              <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-rose-400 to-orange-400" />
              
              <div className="min-w-0 flex-1 pl-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-rose-600 ring-1 ring-inset ring-rose-100">
                    {coupon.code}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-800">{getDiscountLabel(coupon)}</p>
                {coupon.minOrderAmount > 0 && (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Đơn từ {formatCurrency(coupon.minOrderAmount)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(coupon.code)}
                className={`ml-4 shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                  copiedCode === coupon.code
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                    : "bg-rose-500 text-white shadow-sm shadow-rose-200 hover:bg-rose-600 hover:shadow-md hover:shadow-rose-200"
                }`}
              >
                {copiedCode === coupon.code ? (
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" /> Đã lưu
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" /> Lưu mã
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-white p-5 text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <Link
            to="/profile?tab=coupons"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 transition hover:text-rose-600"
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
