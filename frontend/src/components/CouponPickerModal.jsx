import { useEffect, useState } from "react";
import { Loader2, Tag, Truck, X, Search, Check, CircleDollarSign, CircleAlert } from "lucide-react";
import { apiRequest } from "../lib/api.js";

const formatCurrency = (value = 0) =>
  `${Number(value).toLocaleString("vi-VN")}đ`;

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("vi-VN");
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

export default function CouponPickerModal({
  isOpen,
  onClose,
  token,
  subtotal = 0,
  shippingFee = 0,
  selectedCoupon,
  selectedShippingCoupon,
  onApply,
}) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const [pickedCoupon, setPickedCoupon] = useState(selectedCoupon || null);
  const [pickedShippingCoupon, setPickedShippingCoupon] = useState(
    selectedShippingCoupon || null
  );

  useEffect(() => {
    if (isOpen && token) {
      loadCoupons();
    }
  }, [isOpen, token, subtotal]);

  useEffect(() => {
    setPickedCoupon(selectedCoupon || null);
    setPickedShippingCoupon(selectedShippingCoupon || null);
  }, [selectedCoupon, selectedShippingCoupon]);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(
        `/coupons/available?subtotal=${subtotal}`,
        { token }
      );
      setCoupons(res.data || []);
    } catch (err) {
      console.error("Failed to load coupons:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualApply = async () => {
    if (!manualCode.trim()) return;

    setManualLoading(true);
    setManualError("");

    try {
      const res = await apiRequest("/coupons/apply", {
        method: "POST",
        token,
        body: {
          code: manualCode.trim(),
          subtotal,
          shippingFee,
        },
      });

      const { coupon, discountAmount } = res.data;
      const couponData = { ...coupon, potentialDiscount: discountAmount, isEligible: true };

      if (coupon.discountType === "free_shipping") {
        setPickedShippingCoupon(couponData);
      } else {
        setPickedCoupon(couponData);
      }

      setManualCode("");
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualLoading(false);
    }
  };

  const handleConfirm = () => {
    onApply(pickedCoupon, pickedShippingCoupon);
    onClose();
  };

  const productCoupons = coupons.filter(
    (c) => c.discountType !== "free_shipping"
  );
  const shippingCoupons = coupons.filter(
    (c) => c.discountType === "free_shipping"
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-xl font-bold">Chọn mã giảm giá</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition hover:text-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Manual input */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.toUpperCase());
                  setManualError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleManualApply()}
                placeholder="Nhập mã giảm giá"
                className="w-full border border-gray-300 py-2.5 pl-10 pr-3 text-sm uppercase outline-none focus:border-black"
              />
            </div>
            <button
              type="button"
              onClick={handleManualApply}
              disabled={!manualCode.trim() || manualLoading}
              className="whitespace-nowrap bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
            >
              {manualLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Áp dụng"
              )}
            </button>
          </div>
          {manualError && (
            <p className="mt-2 text-xs text-red-600">{manualError}</p>
          )}
        </div>

        {/* Coupon list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Không có mã giảm giá khả dụng
            </div>
          ) : (
            <div className="space-y-6">
              {/* Product discount coupons */}
              {productCoupons.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <Tag className="h-4 w-4" />
                    Giảm giá sản phẩm
                  </h4>
                  <div className="space-y-2">
                    {productCoupons.map((coupon) => (
                      <CouponCard
                        key={coupon._id}
                        coupon={coupon}
                        isSelected={pickedCoupon?._id === coupon._id || pickedCoupon?.code === coupon.code}
                        onSelect={() => {
                          if (!coupon.isEligible) return;
                          setPickedCoupon(
                            pickedCoupon?._id === coupon._id ? null : coupon
                          );
                        }}
                        subtotal={subtotal}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Free shipping coupons */}
              {shippingCoupons.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <Truck className="h-4 w-4" />
                    Miễn phí vận chuyển
                  </h4>
                  <div className="space-y-2">
                    {shippingCoupons.map((coupon) => (
                      <CouponCard
                        key={coupon._id}
                        coupon={coupon}
                        isSelected={pickedShippingCoupon?._id === coupon._id || pickedShippingCoupon?.code === coupon.code}
                        onSelect={() => {
                          if (!coupon.isEligible) return;
                          setPickedShippingCoupon(
                            pickedShippingCoupon?._id === coupon._id
                              ? null
                              : coupon
                          );
                        }}
                        subtotal={subtotal}
                        shippingFee={shippingFee}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          {(pickedCoupon || pickedShippingCoupon) && (
            <div className="mb-3 text-sm text-gray-600">
              <span className="font-medium">Đã chọn: </span>
              {[
                pickedCoupon &&
                `${pickedCoupon.code} (-${formatCurrency(pickedCoupon.potentialDiscount || 0)})`,
                pickedShippingCoupon &&
                `${pickedShippingCoupon.code} (-${formatCurrency(pickedShippingCoupon.discountValue > 0 ? Math.min(pickedShippingCoupon.discountValue, shippingFee) : shippingFee)})`,
              ]
                .filter(Boolean)
                .join(" + ")}
            </div>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full bg-black py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-gray-800"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

function CouponCard({ coupon, isSelected, onSelect, subtotal, shippingFee = 0 }) {
  const isShipping = coupon.discountType === "free_shipping";
  const disabled = !coupon.isEligible;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex w-full items-start gap-3 border-2 p-4 text-left transition ${disabled
        ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
        : isSelected
          ? "border-black bg-gray-50"
          : "border-gray-200 hover:border-gray-400"
        }`}
    >
      {/* Radio */}
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {isSelected ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
            {coupon.code}
          </span>
          <span className="text-sm font-semibold">{getDiscountLabel(coupon)}</span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          {coupon.minOrderAmount > 0 && (
            <span>Đơn từ {formatCurrency(coupon.minOrderAmount)}</span>
          )}
          <span>HSD: {formatDate(coupon.endDate)}</span>
          {coupon.remainingUses !== undefined && (
            <span>Còn {coupon.remainingUses} lượt</span>
          )}
        </div>

        {coupon.isEligible && (isShipping ? (coupon.discountValue > 0 ? Math.min(coupon.discountValue, shippingFee) : shippingFee) : coupon.potentialDiscount) > 0 && (
          <div className="flex gap-1 mt-1.5 text-[13px] font-medium text-green-600">
            <CircleDollarSign className="h-4 w-4 mt-0.5" /> Tiết kiệm: {formatCurrency(isShipping ? (coupon.discountValue > 0 ? Math.min(coupon.discountValue, shippingFee) : shippingFee) : coupon.potentialDiscount)}
          </div>
        )}

        {!coupon.isEligible && coupon.reason && (
          <div className="flex gap-1 mt-1.5 text-[13px] font-medium text-red-600">
            <CircleAlert className="h-4 w-4 mt-0.5" />{coupon.reason}
          </div>
        )}
      </div>
    </button>
  );
}
