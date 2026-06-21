import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronRight, CreditCard, Loader2, MapPin, Plus, Tag, Truck, X } from "lucide-react";
import toast from "react-hot-toast";
import CouponPickerModal from "../components/CouponPickerModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { apiRequest } from "../lib/api.js";
import { formatProductName } from "../lib/productName.js";

const CHECKOUT_SELECTION_KEY = "fashionstore_checkout_cart_item_ids";

const formatCurrency = (value = 0) => `${Number(value).toLocaleString("vi-VN")} đ`;

export default function CheckoutPage() {
  const { token } = useAuth();
  const { refreshCartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const restoredIdsParam = searchParams.get("restoredIds");
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (restoredIdsParam) {
      sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(restoredIdsParam.split(",")));
    }

    if (errorParam) {
      toast.error(errorParam, { id: "checkout-payment-return-error" });
    }

    if (restoredIdsParam || errorParam) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("restoredIds");
      newParams.delete("error");
      setSearchParams(newParams, { replace: true });
    }
  }, [restoredIdsParam, errorParam, searchParams, setSearchParams]);

  const selectedItemIds = (() => {
    if (restoredIdsParam) {
      return restoredIdsParam.split(",");
    }

    const stateIds = location.state?.selectedItemIds || location.state?.cartItemIds;
    if (Array.isArray(stateIds)) return stateIds;

    try {
      const saved = sessionStorage.getItem(CHECKOUT_SELECTION_KEY) || localStorage.getItem(CHECKOUT_SELECTION_KEY) || "[]";
      const parsedIds = JSON.parse(saved);
      return Array.isArray(parsedIds) ? parsedIds : [];
    } catch (_error) {
      return [];
    }
  })();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const [shippingFee, setShippingFee] = useState(30000);
  const [shippingLoading, setShippingLoading] = useState(false);

  const [showCouponModal, setShowCouponModal] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [appliedShippingCoupon, setAppliedShippingCoupon] = useState(null);

  useEffect(() => {
    loadAddresses();
    loadCartItems();
  }, []);

  const loadAddresses = async () => {
    try {
      const response = await apiRequest("/addresses/me", { token });
      const addressList = response.data || [];
      setAddresses(addressList);

      const defaultAddr = addressList.find((addr) => addr.isDefault);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr);
      } else if (addressList.length > 0) {
        setSelectedAddress(addressList[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadCartItems = async () => {
    try {
      const response = await apiRequest("/carts/me", { token });
      const cart = response.data;
      if (cart?.items) {
        const availableItems = cart.items.filter((item) => {
          const isUnavailable = !item.productId || item.productId.isDeleted || !item.variantId || item.variantId.isDeleted || !item.variantId.isActive;
          return !isUnavailable;
        });
        const filtered = selectedItemIds.length > 0
          ? availableItems.filter((item) => selectedItemIds.includes(item._id))
          : availableItems;
        setCartItems(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const basePrice = item.productId?.price || 0;
      const adjustment = item.variantId?.priceAdjustment || 0;
      const price = basePrice + adjustment;
      const productDiscount = item.productId?.discount || 0;
      const variantDiscount = item.variantId?.discount;
      const discount = (variantDiscount !== null && variantDiscount !== undefined)
        ? variantDiscount
        : productDiscount;
      const finalPrice = price - (price * discount) / 100;
      return sum + finalPrice * item.quantity;
    }, 0);
  };

  const subtotal = calculateTotal();

  useEffect(() => {
    const fetchShippingFee = async () => {
      if (subtotal >= 999000) {
        setShippingFee(0);
        return;
      }

      if (selectedAddress?.districtId && selectedAddress?.wardCode) {
        setShippingLoading(true);
        try {
          const res = await apiRequest("/ghn/shipping-fee", {
            method: "POST",
            token,
            body: {
              toDistrictId: selectedAddress.districtId,
              toWardCode: selectedAddress.wardCode,
              weight: 500 * cartItems.length || 500,
              insuranceValue: Math.min(subtotal, 5000000)
            }
          });
          setShippingFee(res.data?.total || 30000);
        } catch (err) {
          console.error("Lỗi tính phí ship GHN:", err);
          setShippingFee(30000); // Fallback
        } finally {
          setShippingLoading(false);
        }
      } else {
        // Fallback for addresses without GHN ID
        setShippingFee(30000);
      }
    };

    if (selectedAddress && cartItems.length > 0) {
      fetchShippingFee();
    }
  }, [selectedAddress, subtotal, cartItems.length, token]);

  // Đơn đã được miễn phí vận chuyển thì tự gỡ mã giảm phí ship (không cho áp chồng)
  useEffect(() => {
    if (shippingFee <= 0 && appliedShippingCoupon) {
      setAppliedShippingCoupon(null);
      toast("Đơn đã được miễn phí vận chuyển nên mã giảm phí ship đã được gỡ.");
    }
  }, [shippingFee, appliedShippingCoupon]);

  const couponDiscount = appliedCoupon?.potentialDiscount || 0;
  const shippingDiscount =
    shippingFee > 0 && appliedShippingCoupon
      ? appliedShippingCoupon.discountValue > 0
        ? Math.min(appliedShippingCoupon.discountValue, shippingFee)
        : shippingFee
      : 0;
  const total = Math.max(subtotal - couponDiscount + shippingFee - shippingDiscount, 0);

  const handleCouponApply = (productCoupon, shipCoupon) => {
    setAppliedCoupon(productCoupon);
    setAppliedShippingCoupon(shipCoupon);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedAddress) {
      toast.error("Vui lòng chọn địa chỉ giao hàng");
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Không có sản phẩm nào để thanh toán");
      return;
    }

    setLoading(true);
    toast.dismiss();

    try {
      const shippingAddress = `${selectedAddress.street}, ${selectedAddress.ward}, ${selectedAddress.district}, ${selectedAddress.province}`;
      const checkoutPayload = {
        receiverName: selectedAddress.fullName,
        receiverPhone: selectedAddress.phoneNumber,
        shippingAddress,
        note: note.trim(),
        paymentMethod,
        shippingFee,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        ...(appliedShippingCoupon ? { shippingCouponCode: appliedShippingCoupon.code } : {}),
        ...(selectedItemIds.length ? { selectedItemIds } : {})
      };

      if (selectedItemIds.length) {
        sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(selectedItemIds));
      }

      // PayPal & VNPay: tạo phiên thanh toán (chưa tạo đơn) rồi chuyển sang cổng
      if (paymentMethod === "paypal" || paymentMethod === "vnpay") {
        const endpoint =
          paymentMethod === "paypal"
            ? "/payment/paypal/create"
            : "/payment/vnpay/create";
        const paymentResponse = await apiRequest(endpoint, {
          method: "POST",
          token,
          body: checkoutPayload
        });

        if (!paymentResponse.data?.paymentUrl) {
          throw new Error("Không nhận được liên kết thanh toán");
        }

        window.location.href = paymentResponse.data.paymentUrl;
        return;
      }

      // COD - tạo đơn ngay và chuyển đến trang đơn hàng
      const orderResponse = await apiRequest("/orders/checkout", {
        method: "POST",
        token,
        body: checkoutPayload
      });

      const orderId = orderResponse.data?.order?._id || orderResponse.data?._id || "";
      const awardedCoupons = orderResponse.data?.awardedCoupons || [];
      const hasAwardedCoupons = awardedCoupons.length > 0;

      localStorage.removeItem(CHECKOUT_SELECTION_KEY);
      sessionStorage.removeItem(CHECKOUT_SELECTION_KEY);
      await refreshCartCount();

      const successParams = new URLSearchParams();
      if (orderId) successParams.set("orderId", orderId);
      if (hasAwardedCoupons) successParams.set("awardedCoupons", "true");
      navigate(`/order/success?${successParams.toString()}`);
    } catch (submitError) {
      toast.error(submitError.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
          <Link to="/cart" className="hover:text-black">Giỏ hàng</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-black">Thanh toán</span>
        </div>

        <h1 className="mb-8 text-3xl font-bold uppercase">Thanh toán</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Địa chỉ giao hàng */}
            <div className="border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <MapPin className="h-5 w-5" />
                  Địa chỉ giao hàng
                </h2>
                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Thay đổi
                  </button>
                )}
              </div>

              {addresses.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 p-8 text-center">
                  <MapPin className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                  <p className="mb-4 text-gray-600">Bạn chưa có địa chỉ giao hàng</p>
                  <Link
                    to="/profile?tab=address"
                    className="inline-flex items-center gap-2 bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm địa chỉ mới
                  </Link>
                </div>
              ) : selectedAddress ? (
                <div className="border border-gray-200 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold">{selectedAddress.fullName}</span>
                    {selectedAddress.isDefault && (
                      <span className="border border-green-600 bg-green-50 px-2 py-0.5 text-xs text-green-600">
                        Mặc định
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-sm text-gray-600">{selectedAddress.phoneNumber}</p>
                  <p className="text-sm text-gray-600">
                    {selectedAddress.street}, {selectedAddress.ward}, {selectedAddress.district}, {selectedAddress.province}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Sản phẩm */}
            <div className="border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">Sản phẩm ({cartItems.length})</h2>
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const product = item.productId;
                  const variant = item.variantId;
                  const basePrice = product?.price || 0;
                  const adjustment = variant?.priceAdjustment || 0;
                  const price = basePrice + adjustment;
                  const productDiscount = product?.discount || 0;
                  const variantDiscount = variant?.discount;
                  const discount = (variantDiscount !== null && variantDiscount !== undefined)
                    ? variantDiscount
                    : productDiscount;
                  const finalPrice = price - (price * discount) / 100;
                  const image = variant?.image || product?.images?.[0] || "";
                  const displayName = formatProductName(product?.name);

                  return (
                    <div key={item._id} className="flex gap-4 border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden border border-gray-200 bg-gray-50">
                        {image && (
                          <img src={image} alt={displayName} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="mb-1 font-medium">{displayName}</h3>
                        <p className="mb-2 text-sm text-gray-600">
                          {variant?.color && `Màu: ${variant.color}`}
                          {variant?.color && variant?.size && " • "}
                          {variant?.size && `Size: ${variant.size}`}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">x{item.quantity}</span>
                          <span className="font-semibold">{formatCurrency(finalPrice * item.quantity)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ghi chú */}
            <div className="border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">Ghi chú đơn hàng</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Ghi chú về đơn hàng, ví dụ: thời gian hay chỉ dẫn địa điểm giao hàng chi tiết hơn"
                className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>
          </div>

          {/* Tóm tắt đơn hàng + Phương thức thanh toán */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">Tóm tắt đơn hàng</h2>

              <div className="mb-5 space-y-3 border-b border-gray-200 pb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tạm tính</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Phí vận chuyển</span>
                  <span className="font-medium">
                    {shippingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                    ) : shippingFee === 0 ? (
                      <span className="text-green-600 font-semibold">Miễn phí</span>
                    ) : (
                      formatCurrency(shippingFee)
                    )}
                  </span>
                </div>

                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Giảm giá sản phẩm</span>
                    <span className="font-medium text-green-600">-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
                {shippingDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Giảm phí vận chuyển</span>
                    <span className="font-medium text-green-600">-{formatCurrency(shippingDiscount)}</span>
                  </div>
                )}
              </div>

              {/* Coupon selection */}
              <div className="mb-5 space-y-3 border-b border-gray-200 pb-5">
                <h3 className="text-sm font-bold">Mã giảm giá</h3>

                {/* Unified Coupon Button */}
                <button
                  type="button"
                  onClick={() => setShowCouponModal(true)}
                  className="flex w-full items-center gap-3 border border-gray-200 p-3 text-left transition hover:border-black"
                >
                  <Tag className="h-4 w-4 shrink-0 text-gray-500" />
                  {appliedCoupon || appliedShippingCoupon ? (
                    <div className="flex flex-1 items-center justify-between">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                        {appliedCoupon && (
                          <div>
                            <span className="text-sm font-medium">{appliedCoupon.code}</span>
                            <span className="ml-2 text-xs text-green-600">-{formatCurrency(couponDiscount)}</span>
                          </div>
                        )}
                        {appliedCoupon && appliedShippingCoupon && (
                          <span className="hidden text-gray-300 sm:inline">|</span>
                        )}
                        {appliedShippingCoupon && (
                          <div>
                            <span className="text-sm font-medium">{appliedShippingCoupon.code}</span>
                            <span className="ml-2 text-xs text-blue-600">-{formatCurrency(shippingDiscount)} phí ship</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAppliedCoupon(null);
                          setAppliedShippingCoupon(null);
                        }}
                        className="ml-2 shrink-0 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="flex-1 text-sm text-gray-500">Chọn hoặc nhập mã giảm giá</span>
                  )}
                </button>
              </div>

              <div className="mb-6 flex justify-between">
                <span className="text-lg font-bold">Tổng cộng</span>
                <span className="text-xl font-bold text-red-600">{formatCurrency(total)}</span>
              </div>

              {/* Phương thức thanh toán */}
              <div className="mb-6 border-t border-gray-200 pt-5">
                <h3 className="mb-4 text-base font-bold">Phương thức thanh toán</h3>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center gap-3 border border-gray-200 p-4 transition hover:border-black">
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-4 w-4"
                    />
                    <Truck className="h-5 w-5 text-gray-600" />
                    <span className="flex-1 text-sm font-medium">Thanh toán khi nhận hàng (COD)</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 border border-gray-200 p-4 transition hover:border-black">
                    <input
                      type="radio"
                      name="payment"
                      value="vnpay"
                      checked={paymentMethod === "vnpay"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-4 w-4"
                    />
                    <CreditCard className="h-5 w-5 text-gray-600" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">VNPay</div>
                      <div className="text-xs text-gray-500">Thẻ ATM, Visa, MasterCard</div>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 border border-gray-200 p-4 transition hover:border-black">
                    <input
                      type="radio"
                      name="payment"
                      value="paypal"
                      checked={paymentMethod === "paypal"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-4 w-4"
                    />
                    <CreditCard className="h-5 w-5 text-gray-600" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">PayPal</div>
                      <div className="text-xs text-gray-500">Thanh toán quốc tế</div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || addresses.length === 0}
                className="w-full bg-black px-6 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-gray-800 disabled:bg-gray-300"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </span>
                ) : (
                  "Đặt hàng"
                )}
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Check className="h-4 w-4" />
                <span>Đảm bảo thanh toán an toàn</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal chọn địa chỉ */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Chọn địa chỉ giao hàng</h3>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="max-h-96 space-y-3 overflow-y-auto">
              {addresses.map((address) => (
                <label
                  key={address._id}
                  className={`flex cursor-pointer items-start gap-3 border-2 p-4 transition ${selectedAddress?._id === address._id
                    ? "border-black bg-gray-50"
                    : "border-gray-200 hover:border-gray-400"
                    }`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddress?._id === address._id}
                    onChange={() => {
                      setSelectedAddress(address);
                      setShowAddressModal(false);
                    }}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold">{address.fullName}</span>
                      {address.isDefault && (
                        <span className="border border-green-600 bg-green-50 px-2 py-0.5 text-xs text-green-600">
                          Mặc định
                        </span>
                      )}
                    </div>
                    <p className="mb-1 text-sm text-gray-600">{address.phoneNumber}</p>
                    <p className="text-sm text-gray-600">
                      {address.street}, {address.ward}, {address.district}, {address.province}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 border-t border-gray-200 pt-4">
              <Link
                to="/profile?tab=address"
                className="flex items-center justify-center gap-2 border border-gray-300 px-6 py-3 text-sm font-medium transition hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Thêm địa chỉ mới
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Picker Modal */}
      <CouponPickerModal
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        token={token}
        subtotal={subtotal}
        shippingFee={shippingFee}
        selectedCoupon={appliedCoupon}
        selectedShippingCoupon={appliedShippingCoupon}
        onApply={handleCouponApply}
      />
    </div>

  );
}
