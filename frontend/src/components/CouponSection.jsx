import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Copy, Check, Tag, Truck, BadgePercent } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api.js";

const formatCurrency = (v = 0) => `${Number(v).toLocaleString("vi-VN")}đ`;

const RECEIVED_KEY = "fs-received-coupons";

const TYPE_ICONS = {
  percentage: BadgePercent,
  fixed_amount: Tag,
  free_shipping: Truck
};

const getDiscountLabel = (coupon) => {
  switch (coupon.discountType) {
    case "percentage":
      return `Giảm ${coupon.discountValue}%`;
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
  if (coupon.discountType === "percentage" && coupon.maxDiscountAmount) {
    return `Tối đa ${formatCurrency(coupon.maxDiscountAmount)}`;
  }
  if (coupon.minOrderAmount > 0) {
    return `Đơn từ ${formatCurrency(coupon.minOrderAmount)}`;
  }
  return "Áp dụng mọi đơn";
};

export default function CouponSection() {
  const [coupons, setCoupons] = useState([]);
  const [receivedCodes, setReceivedCodes] = useState([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest("/coupons/public");
        setCoupons(res.data || []);
      } catch (err) {
        console.error("Failed to load coupons:", err);
      }
    };
    load();

    const stored = localStorage.getItem(RECEIVED_KEY);
    if (stored) {
      setReceivedCodes(JSON.parse(stored));
    }
  }, []);

  const handleCopy = async (code) => {
    if (receivedCodes.includes(code)) return; // Already received

    const newReceived = [...receivedCodes, code];
    setReceivedCodes(newReceived);
    localStorage.setItem(RECEIVED_KEY, JSON.stringify(newReceived));

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
  };

  if (coupons.length === 0) return null;

  const pageCount = Math.max(1, coupons.length - 3);
  const visibleCoupons = coupons.slice(page, page + 4);

  return (
    <section>
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 gap-2">
            <Tag className="h-4 w-4 text-gray-400" strokeWidth={2} />Ưu đãi
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-black md:text-3xl">
            Mã giảm giá
          </h2>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-gray-500">
            Nhập mã khi thanh toán để nhận ưu đãi hấp dẫn từ FashionStore.
          </p>
        </div>
        <Link
          to="/profile?tab=coupons"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-black transition hover:gap-3"
        >
          Xem tất cả
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="group relative">
        {coupons.length > 4 && (
          <>
            <button
              type="button"
              onClick={() => setPage((prev) => (prev === 0 ? pageCount - 1 : prev - 1))}
              className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 grid h-12 w-12 place-items-center bg-white text-black shadow-lg opacity-0 transition-all duration-300 group-hover:opacity-100 md:-left-6"
              aria-label="Trang trước"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => (prev === pageCount - 1 ? 0 : prev + 1))}
              className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 grid h-12 w-12 place-items-center bg-white text-black shadow-lg opacity-0 transition-all duration-300 group-hover:opacity-100 md:-right-6"
              aria-label="Trang sau"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleCoupons.map((coupon) => {
            const isReceived = receivedCodes.includes(coupon.code);
            const isFreeShipping = coupon.discountType === "free_shipping";
            const bgClass = isFreeShipping ? "bg-blue-50" : "bg-emerald-50";
            const iconClass = isFreeShipping ? "text-blue-600" : "text-emerald-600";
            const btnHoverClass = isFreeShipping ? "hover:bg-blue-600 hover:text-white" : "hover:bg-emerald-600 hover:text-white";
            const Icon = TYPE_ICONS[coupon.discountType] || Tag;

            return (
              <div
                key={coupon._id}
                className={`relative flex w-full cursor-pointer flex-col overflow-hidden ${bgClass} p-5 shadow-sm transition hover:scale-[1.02]`}
                onClick={() => handleCopy(coupon.code)}
              >
                {/* Info */}
                <div className="mb-2">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${iconClass}`} strokeWidth={1.5} />
                    <h4 className={`text-base font-black ${iconClass}`}>{coupon.code}</h4>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {getDiscountLabel(coupon)}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">{getSubLabel(coupon)}</p>

                  <div className="mt-3">
                    {coupon.maxUsage > 0 ? (
                      <>
                        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          <span>Đã dùng</span>
                          <span>{Math.min(100, Math.round((coupon.currentUsage / coupon.maxUsage) * 100))}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isFreeShipping ? "bg-blue-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, (coupon.currentUsage / coupon.maxUsage) * 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          <span>Đã dùng: {coupon.currentUsage}</span>
                          <span>Không giới hạn</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isFreeShipping ? "bg-blue-300" : "bg-emerald-300"}`}
                            style={{ width: "100%" }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Dotted divider with cutouts */}
                <div className="relative my-4 flex h-0 w-full items-center justify-center border-t-[2px] border-dashed border-white">
                  <div className="absolute -left-8 h-6 w-6 rounded-full bg-white shadow-inner"></div>
                  <div className="absolute -right-8 h-6 w-6 rounded-full bg-white shadow-inner"></div>
                </div>

                {/* Action button */}
                <div className="mt-auto">
                  <button
                    type="button"
                    disabled={isReceived}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(coupon.code);
                    }}
                    className={`flex w-full items-center justify-center gap-2 rounded bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition shadow-sm ${isReceived
                      ? "text-gray-400 cursor-not-allowed"
                      : `${iconClass} ${btnHoverClass}`
                      }`}
                  >
                    {isReceived ? (
                      <>
                        <Check className="h-4 w-4" /> ĐÃ NHẬN
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> SAO CHÉP MÃ
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
