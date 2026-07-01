import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Tag, Truck, BadgePercent, Ticket, X } from "lucide-react";
import { apiRequest } from "../lib/api.js";

const formatCurrency = (v = 0) => `${Number(v).toLocaleString("vi-VN")}đ`;

const formatDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const TYPE_ICONS = {
  percentage: BadgePercent,
  fixed_amount: Tag,
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

export default function CouponsTab({ token }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedCoupon, setSelectedCoupon] = useState(null);

  useEffect(() => {
    loadCoupons();
  }, [token]);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/coupons/saved", { token });
      setCoupons(res.data || []);
    } catch (err) {
      console.error("Failed to load coupons:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (code) => {
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
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const productCoupons = coupons.filter(
    (c) => c.discountType !== "free_shipping"
  );
  const shippingCoupons = coupons.filter(
    (c) => c.discountType === "free_shipping"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Ticket className="mb-4 h-12 w-12 text-gray-300" strokeWidth={1} />
        <h3 className="text-lg font-medium text-gray-700">Chưa có mã giảm giá</h3>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          Hiện tại chưa có mã giảm giá khả dụng. Hãy quay lại sau nhé!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold border-b border-gray-300 pb-4">Danh sách mã giảm giá</h2>
      {/* Product discount coupons */}
      {productCoupons.length > 0 && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-600">
            <Tag className="h-4 w-4" />
            Giảm giá sản phẩm
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {productCoupons.map((coupon) => (
              <CouponCard
                key={coupon._id}
                coupon={coupon}
                copiedCode={copiedCode}
                onCopy={handleCopy}
                onClick={() => setSelectedCoupon(coupon)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Free shipping coupons */}
      {shippingCoupons.length > 0 && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-600">
            <Truck className="h-4 w-4" />
            Miễn phí vận chuyển
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {shippingCoupons.map((coupon) => (
              <CouponCard
                key={coupon._id}
                coupon={coupon}
                copiedCode={copiedCode}
                onCopy={handleCopy}
                onClick={() => setSelectedCoupon(coupon)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCoupon && (
        <CouponDetailModal
          coupon={selectedCoupon}
          onClose={() => setSelectedCoupon(null)}
        />
      )}
    </div>
  );
}

function CouponDetailModal({ coupon, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-white overflow-visible"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:bg-gray-100 hover:scale-105"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Dark Section */}
        <div className="bg-black p-8 text-white flex gap-6 items-center">
          <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded border-2 border-dashed border-white/40">
            <BadgePercent className="h-10 w-10 text-white" strokeWidth={1} />
          </div>
          <div>
            <h3 className="text-xl font-bold">{getDiscountLabel(coupon)} {coupon.minOrderAmount > 0 ? `đơn từ ${formatCurrency(coupon.minOrderAmount)}` : ""}</h3>
            {coupon.discountType !== "percentage" && coupon.discountValue > 0 && (
              <p className="mt-2 text-lg font-semibold">{coupon.discountValue.toLocaleString("vi-VN")}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-400">Mã</span>
              <span className="text-lg font-bold">{coupon.code}</span>
            </div>
          </div>
        </div>

        {/* Bottom Light Section */}
        <div className="p-8 space-y-6">
          <div>
            <h4 className="text-sm font-bold text-black mb-1">Ưu đãi</h4>
            <p className="text-sm text-gray-600">
              {coupon.discountType === "free_shipping"
                ? "Miễn phí vận chuyển cho toàn bộ sản phẩm"
                : "Áp dụng giảm giá cho toàn bộ sản phẩm"}
              {coupon.maxDiscountAmount > 0 ? ` (tối đa ${formatCurrency(coupon.maxDiscountAmount)})` : ""}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-black mb-1">Có hiệu lực</h4>
            <p className="text-sm text-gray-600">
              {formatDate(coupon.startDate)} - {formatDate(coupon.endDate)}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-black mb-1">Thanh toán</h4>
            <p className="text-sm text-gray-600">Tất cả hình thức thanh toán</p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-black mb-1">Xem chi tiết</h4>
            <p className="text-sm text-gray-600">
              {coupon.description || "Không áp dụng đồng thời với chương trình khuyến mãi khác"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CouponCard({ coupon, copiedCode, onCopy, onClick }) {
  const copied = copiedCode === coupon.code;

  // Calculate remaining days
  const endDate = new Date(coupon.endDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const daysText = diffDays > 0 ? `còn ${diffDays} ngày` : "Hết hạn";

  const isFreeShipping = coupon.discountType === "free_shipping";
  const bgClass = isFreeShipping ? "bg-blue-50" : "bg-emerald-50";
  const checkClass = isFreeShipping ? "text-blue-600" : "text-emerald-600";

  return (
    <div
      className={`relative flex w-full cursor-pointer overflow-hidden rounded-lg ${bgClass} shadow-sm transition hover:scale-[1.02]`}
      onClick={onClick}
    >
      {/* Left section (Info) */}
      <div className="flex-1 p-4">
        <h4 className="text-base font-black text-gray-900">{coupon.code}</h4>
        <p className="mt-1 text-sm font-medium text-gray-800">
          {getDiscountLabel(coupon)}
          {coupon.minOrderAmount > 0 ? ` đơn từ ${formatCurrency(coupon.minOrderAmount)}` : ""}
        </p>
        <p className="mt-1.5 text-xs text-gray-500">Hạn sử dụng: {daysText}</p>

        <div className="mt-3 pr-2">
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
                <span>Đã dùng: {coupon.currentUsage || 0}</span>
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
      <div className="relative flex w-0 flex-col items-center justify-center border-l-2 border-dashed border-gray-300">
        <div className="absolute -top-3 h-6 w-6 rounded-full bg-white shadow-inner"></div>
        <div className="absolute -bottom-3 h-6 w-6 rounded-full bg-white shadow-inner"></div>
      </div>

      {/* Right section (Action) */}
      <div className="flex w-16 flex-shrink-0 items-center justify-center p-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(coupon.code);
          }}
          className="text-gray-700 transition hover:text-black"
          title="Sao chép mã"
        >
          {copied ? (
            <Check className={`h-5 w-5 ${checkClass}`} />
          ) : (
            <Copy className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
