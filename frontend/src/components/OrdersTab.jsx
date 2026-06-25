import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api.js";
import { formatProductName } from "../lib/productName.js";
import {
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  CreditCard,
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  X,
  Star,
  Eye,
  ShoppingCart,
} from "lucide-react";

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "confirmed", label: "Đang xử lý" },
  { value: "shipping", label: "Đang giao" },
  { value: "completed", label: "Hoàn thành" },
  { value: "pending_review", label: "Chờ đánh giá" },
  { value: "cancelled", label: "Đã hủy" },
];

const hasPendingReview = (order) =>
  order.status === "completed" &&
  order.items?.some(
    (item) =>
      item.productId?._id && !item.productId.isDeleted && !item.isReviewed,
  );

export default function OrdersTab({ token }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("/orders/me", { token });
      setOrders(response.data);
      setFilteredOrders(response.data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Apply filters
  useEffect(() => {
    let result = orders;

    // Search by order ID
    if (searchTerm) {
      result = result.filter((order) =>
        order._id.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by status
    if (statusFilter === "pending_review") {
      result = result.filter((order) => hasPendingReview(order));
    } else if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter);
    }

    setFilteredOrders(result);
  }, [
    orders,
    searchTerm,
    statusFilter,
  ]);

  const openCancelModal = (orderId) => {
    setCancelOrderId(orderId);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelOrderId("");
    setCancelReason("");
  };

  const cancelOrder = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setError("Vui lòng nhập lý do hủy đơn hàng");
      return;
    }

    try {
      await apiRequest(`/orders/me/${cancelOrderId}/cancel`, {
        method: "PATCH",
        token,
        body: {
          cancellationReason: reason,
        },
      });
      closeCancelModal();
      loadOrders();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const markOrderAsReceived = async (orderId) => {
    try {
      setError("");
      await apiRequest(`/orders/me/${orderId}/received`, {
        method: "PATCH",
        token,
      });
      await loadOrders();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "confirmed":
        return <CheckCircle className="h-4 w-4" />;
      case "shipping":
        return <Truck className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "shipping":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "completed":
        return "bg-green-100 text-green-800 border-green-300";
      case "cancelled":
        return "bg-red-100 text-red-600 border-red-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  const translateStatus = (status) => {
    const map = {
      pending: "Chờ xác nhận",
      confirmed: "Đang xử lý",
      shipping: "Đang giao",
      completed: "Hoàn thành",
      cancelled: "Đã hủy",
    };
    return map[status] || status;
  };

  const translatePaymentMethod = (method) => {
    const map = {
      cod: "COD",
      vnpay: "VNPay",
      paypal: "PayPal",
    };
    return map[method] || method;
  };

  const translatePaymentStatus = (status) => {
    const map = {
      pending: "Chờ thanh toán",
      paid: "Đã thanh toán",
      failed: "Thất bại",
      refunded: "Đã hoàn tiền",
    };
    return map[status] || status;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleOrderDetail = (orderId) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Quản lý đơn hàng</h2>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="relative max-w">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã đơn hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-full border border-gray-200 bg-white pl-11 pr-11 text-sm outline-none transition focus:border-black"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-black"
              aria-label="Xóa tìm kiếm"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="-mx-1 flex gap-2 px-1 pb-1">
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`h-10 flex-1 rounded-full border text-sm font-semibold transition ${isActive
                  ? "border-black bg-black text-white shadow-sm shadow-black/10"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {(searchTerm || statusFilter !== "all") && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <span>
              Tìm thấy <span className="font-semibold text-gray-900">{filteredOrders.length}</span> đơn hàng
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="font-semibold text-gray-700 underline-offset-4 hover:text-black hover:underline"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black border-r-transparent"></div>
          <p className="mt-3 text-sm text-gray-600">Đang tải đơn hàng...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-16">
          <ShoppingCart className="h-14 w-14 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Không tìm thấy đơn hàng
          </h3>
          <p className="text-gray-500 mb-6">
            {orders.length === 0
              ? "Bạn chưa có đơn hàng nào. Hãy khám phá sản phẩm của chúng tôi!"
              : "Không có đơn hàng nào phù hợp với bộ lọc của bạn."}
          </p>
          {orders.length === 0 ? (
            <a
              href="/"
              className="inline-block bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Tiếp tục mua sắm
            </a>
          ) : (
            <button
              onClick={clearFilters}
              className="inline-block bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div
          className={`space-y-4 ${filteredOrders.length > 3 ? "max-h-[920px] overflow-y-auto pr-1" : ""}`}
        >
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order._id;

            return (
              <div
                key={order._id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-500">
                            Mã đơn:
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            #{order._id.slice(-8).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}
                      >
                        {getStatusIcon(order.status)}
                        {translateStatus(order.status)}
                      </span>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-0.5">
                          Tổng tiền
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {order.totalPrice?.toLocaleString("vi-VN")}₫
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Products Preview */}
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {order.items
                      ?.slice(0, isExpanded ? undefined : 2)
                      .map((item) => {
                        const productSnapshot = item.productSnapshot;
                        const variantSnapshot = item.variantSnapshot;

                        const pName = formatProductName(item.productId?.name || productSnapshot?.name) || "Sản phẩm";
                        const pImage = item.variantId?.image || item.productId?.images?.[0] || variantSnapshot?.image || productSnapshot?.image;
                        const pColor = item.variantId?.color || variantSnapshot?.color || "N/A";
                        const pSize = item.variantId?.size || variantSnapshot?.size || "N/A";
                        const isDeleted = !item.productId || item.productId.isDeleted;

                        return (
                          <div key={item._id} className={`flex gap-4 ${isDeleted ? "opacity-75" : ""}`}>
                            <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                              {pImage && (
                                <img
                                  src={pImage}
                                  alt={pName}
                                  className={`w-full h-full object-cover ${isDeleted ? "grayscale" : ""}`}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1 flex items-center gap-2">
                                {pName}
                                {isDeleted && (
                                  <span className="inline-block shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-600">
                                    Đã ngừng kinh doanh
                                  </span>
                                )}
                              </h4>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                <span>{pColor}</span>
                                <span>•</span>
                                <span>Size {pSize}</span>
                                <span>•</span>
                                <span>x{item.quantity}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-900">
                                  {(item.price * item.quantity)?.toLocaleString(
                                    "vi-VN",
                                  )}
                                  ₫
                                </div>
                                {order.status === "completed" && item.productId?._id && !item.productId.isDeleted && (
                                  <div>
                                    {item.isReviewed ? (
                                      <Link
                                        to={`/products/${item.productId._id}?color=${encodeURIComponent(
                                          pColor,
                                        )}#reviews`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                                      >
                                        <Eye size={14} />
                                        Xem đánh giá
                                      </Link>
                                    ) : (
                                      <Link
                                        to={`/products/${item.productId._id}?color=${encodeURIComponent(
                                          pColor,
                                        )}&review=true&orderId=${order._id}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                                      >
                                        <Star size={14} />
                                        Đánh giá
                                      </Link>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {!isExpanded && order.items?.length > 2 && (
                      <div className="text-sm text-gray-500 text-center py-2 bg-gray-50 rounded">
                        Và {order.items.length - 2} sản phẩm khác
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Shipping Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <h5 className="text-sm font-semibold text-gray-900">
                            Thông tin giao hàng
                          </h5>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-2 text-sm">
                          <div className="grid grid-cols-[110px_1fr] gap-x-1 gap-y-2 text-gray-900">
                            <div className="font-semibold">Người nhận:</div>
                            <div>{order.receiverName}</div>

                            <div className="font-semibold">Số điện thoại:</div>
                            <div>{order.receiverPhone}</div>

                            <div className="font-semibold">Địa chỉ:</div>
                            <div className="leading-relaxed text-left">
                              {order.shippingAddress}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="h-4 w-4 text-gray-500" />
                          <h5 className="text-sm font-semibold text-gray-900">
                            Thông tin thanh toán
                          </h5>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Phương thức:</span>
                            <span className="font-medium text-gray-900">
                              {translatePaymentMethod(order.paymentMethod)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Trạng thái:</span>
                            <span
                              className={`font-medium ${order.paymentStatus === "paid"
                                ? "text-green-600"
                                : order.paymentStatus === "failed"
                                  ? "text-red-600"
                                  : "text-yellow-600"
                                }`}
                            >
                              {translatePaymentStatus(order.paymentStatus)}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-gray-200 space-y-1">
                            <div className="flex justify-between text-gray-600">
                              <span>Tạm tính:</span>
                              <span>
                                {order.subTotal?.toLocaleString("vi-VN")}₫
                              </span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                              <span>Phí vận chuyển:</span>
                              <span>
                                {order.shippingFee?.toLocaleString("vi-VN")}₫
                              </span>
                            </div>
                            {order.couponDiscount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Giảm giá SP ({order.couponCode}):</span>
                                <span>
                                  -{order.couponDiscount?.toLocaleString("vi-VN")}₫
                                </span>
                              </div>
                            )}
                            {order.shippingDiscount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Giảm phí ship ({order.shippingCouponCode}):</span>
                                <span>
                                  -{order.shippingDiscount?.toLocaleString("vi-VN")}₫
                                </span>
                              </div>
                            )}
                            {order.discount > 0 && !order.couponDiscount && !order.shippingDiscount && (
                              <div className="flex justify-between text-red-600">
                                <span>Giảm giá:</span>
                                <span>
                                  -{order.discount?.toLocaleString("vi-VN")}₫
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                              <span>Tổng cộng:</span>
                              <span>
                                {order.totalPrice?.toLocaleString("vi-VN")}₫
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h5 className="text-sm font-semibold text-gray-900 mb-2">
                        Ghi chú
                      </h5>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
                        {order.note?.trim() ? order.note : "Không có ghi chú"}
                      </div>
                    </div>

                    {order.status === "cancelled" &&
                      order.cancellationReason && (
                        <div className="mt-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-2">
                            Lý do hủy đơn
                          </h5>
                          <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-sm text-red-700">
                            {order.cancellationReason}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 py-4 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => toggleOrderDetail(order._id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Thu gọn
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Xem chi tiết
                        </>
                      )}
                    </button>

                    {["pending", "confirmed"].includes(order.status) && (
                      <button
                        onClick={() => openCancelModal(order._id)}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Hủy đơn hàng
                      </button>
                    )}

                    {order.status === "shipping" && (
                      <button
                        onClick={() => markOrderAsReceived(order._id)}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Đã nhận được hàng
                      </button>
                    )}
                  </div>

                  <div className="ml-auto flex items-center gap-3">
                    {order.status === "completed" && (
                      <button
                        onClick={async () => {
                          try {
                            const addedItemIds = [];

                            for (const item of order.items || []) {
                              if (item.variantId?._id && item.productId?._id) {
                                try {
                                  const response = await apiRequest("/carts/me/items", {
                                    method: "POST",
                                    token,
                                    body: {
                                      productId: item.productId._id,
                                      variantId: item.variantId._id,
                                      quantity: item.quantity,
                                      source: "reorder"
                                    }
                                  });

                                  if (response.data?._id) {
                                    addedItemIds.push(response.data._id);
                                  }
                                } catch (err) {
                                  console.error("Failed to add item:", err);
                                }
                              }
                            }

                            if (addedItemIds.length > 0) {
                              // Lưu danh sách item IDs đã chọn vào sessionStorage
                              sessionStorage.setItem("fashionstore_checkout_cart_item_ids", JSON.stringify(addedItemIds));
                              localStorage.removeItem("fashionstore_checkout_cart_item_ids");

                              // Chuyển đến trang giỏ hàng
                              navigate("/cart");
                            } else {
                              setError("Không thể thêm sản phẩm vào giỏ hàng");
                            }
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Mua lại
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Hủy đơn hàng</h3>
              <button
                type="button"
                onClick={closeCancelModal}
                className="text-gray-500 hover:text-black transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-700">
                Vui lòng cho chúng tôi biết lý do bạn muốn hủy đơn hàng này.
                Thông tin này giúp chúng tôi cải thiện dịch vụ tốt hơn.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Lý do hủy đơn <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ví dụ: Tôi muốn thay đổi địa chỉ giao hàng, Tôi tìm được sản phẩm tốt hơn, Thời gian giao hàng quá lâu..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeCancelModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={cancelOrder}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
