import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  Truck,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import { formatProductName } from "../../lib/productName.js";
import toast from "react-hot-toast";

const orderStatuses = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Hủy đơn" },
];

const statusMap = {
  pending: {
    label: "Chờ xác nhận",
    className: "border-yellow-200 text-yellow-600",
    icon: Clock3,
  },
  confirmed: {
    label: "Đã xác nhận",
    className: "border-blue-200 text-blue-600",
    icon: CheckCircle2,
  },
  shipping: {
    label: "Đang giao",
    className: "border-purple-200 text-purple-600",
    icon: Truck,
  },
  completed: {
    label: "Hoàn thành",
    className: "border-emerald-200 text-emerald-600",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Đã hủy",
    className: "border-red-200 text-red-600",
    icon: XCircle,
  },
};

const allowedStatusTransitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["completed"],
  completed: [],
  cancelled: [],
};

const getAllowedStatuses = (currentStatus) => {
  const nextStatuses = allowedStatusTransitions[currentStatus] || [];
  return [currentStatus, ...nextStatuses];
};

const paymentStatusMap = {
  pending: {
    label: "Chờ thanh toán",
    className: "border-yellow-200 text-yellow-500",
    icon: Clock3,
  },
  paid: {
    label: "Đã thanh toán",
    className: "border-emerald-200 text-emerald-600",
    icon: CheckCircle2,
  },
  failed: {
    label: "Thanh toán thất bại",
    className: "border-red-200 text-red-600",
    icon: XCircle,
  },
  refunded: {
    label: "Đã hoàn tiền",
    className: "border-purple-200 text-purple-600",
    icon: RotateCcw,
  },
};

const getRefundEligibility = (order) => {
  if (order.paymentStatus === "refunded") {
    return { ok: false, reason: "Đơn hàng đã được hoàn tiền" };
  }
  if (order.paymentStatus !== "paid") {
    return { ok: false, reason: "Đơn hàng chưa thanh toán, không thể hoàn tiền" };
  }
  if (!["cancelled", "completed"].includes(order.status)) {
    return { ok: false, reason: "Đơn cần được hủy hoặc hoàn thành trước khi hoàn tiền" };
  }
  return { ok: true, reason: "" };
};

const paymentMethodText = {
  cod: "Thanh toán khi nhận hàng (COD)",
  vnpay: "VNPay",
  paypal: "PayPal",
};

const formatCurrency = (value) => `${(value || 0).toLocaleString("vi-VN")} ₫`;

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminOrderDetailPage() {
  const { token } = useAuth();
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const loadOrderDetail = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest(`/orders/admin/${orderId}`, { token });
      setOrder(response.data || null);
    } catch (requestError) {
      setError(requestError.message || "Không thể tải chi tiết đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderDetail();
  }, [orderId, token]);

  const submitStatusUpdate = async (status, cancellationReason = "") => {
    try {
      setUpdating(true);
      await apiRequest(`/orders/admin/${orderId}/status`, {
        method: "PATCH",
        token,
        body: {
          status,
          cancellationReason,
        },
      });
      toast.success("Cập nhật trạng thái đơn hàng thành công");
      await loadOrderDetail();
    } catch (requestError) {
      toast.error(requestError.message || "Cập nhật trạng thái thất bại");
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = (nextStatus) => {
    if (!order || order.status === nextStatus) return;

    if (nextStatus === "cancelled") {
      setCancelReason("");
      setShowCancelModal(true);
      return;
    }

    submitStatusUpdate(nextStatus);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelReason("");
  };

  const confirmCancelOrder = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Vui lòng nhập lý do hủy đơn hàng");
      return;
    }

    await submitStatusUpdate("cancelled", reason);
    closeCancelModal();
  };

  const closeRefundModal = () => {
    if (refunding) return;
    setShowRefundModal(false);
    setRefundReason("");
  };

  const confirmRefundOrder = async () => {
    if (refunding) return;
    if (!getRefundEligibility(order).ok) return;

    const reason = refundReason.trim();
    if (!reason) {
      toast.error("Vui lòng nhập lý do hoàn tiền");
      return;
    }

    try {
      setRefunding(true);
      await apiRequest(`/orders/admin/${orderId}/refund`, {
        method: "PATCH",
        token,
        body: { refundReason: reason },
      });
      toast.success("Hoàn tiền đơn hàng thành công");
      setShowRefundModal(false);
      setRefundReason("");
      await loadOrderDetail();
    } catch (requestError) {
      toast.error(requestError.message || "Hoàn tiền thất bại");
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-slate-50 p-6">
        <AdminPageHeader
          title="Chi tiết đơn hàng"
          description="Đang tải dữ liệu..."
        />
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-[360px] items-center justify-center px-6 py-16">
            <div className="text-center">
              <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
              <p className="text-sm font-medium text-slate-600">
                Đang tải chi tiết đơn hàng...
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="min-h-screen bg-slate-50 p-6">
        <AdminPageHeader
          title="Chi tiết đơn hàng"
          description="Không thể hiển thị thông tin đơn hàng"
        />
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-sm font-medium text-red-700 shadow-sm">
          {error || "Không tìm thấy đơn hàng"}
        </div>
        <Link
          to="/admin/orders"
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl border border-slate-900 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-900 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách đơn hàng
        </Link>
      </section>
    );
  }

  const statusConfig = statusMap[order.status] || statusMap.pending;
  const StatusIcon = statusConfig.icon;
  const paymentConfig = paymentStatusMap[order.paymentStatus] || paymentStatusMap.pending;
  const PaymentIcon = paymentConfig.icon;
  const allowedStatuses = getAllowedStatuses(order.status);
  const isFinalStatus = ["completed", "cancelled"].includes(order.status);
  const refundEligibility = getRefundEligibility(order);

  return (
    <section className="min-h-screen bg-slate-50 p-6">
      <AdminPageHeader
        title={`Đơn hàng #${order._id.slice(-8).toUpperCase()}`}
        description={`Tạo lúc ${formatDateTime(order.createdAt)} · Khách hàng: ${order.userId?.fullname || order.userId?.username || "-"}`}
        aside={
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Link>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-slate-950 to-slate-800 px-6 py-6 text-white">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase text-slate-300">
                    Chi tiết đơn hàng
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">
                    #{order._id.slice(-8).toUpperCase()}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Ngày tạo: {formatDateTime(order.createdAt)}
                  </p>
                </div>

                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold bg-white ${statusConfig.className}`}
                >
                  <StatusIcon className="h-4 w-4" />
                  {statusConfig.label}
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3 text-slate-500">
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase">Ngày tạo</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {formatDateTime(order.createdAt)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3 text-slate-500">
                  <Wallet className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase">
                    Thanh toán
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {paymentMethodText[order.paymentMethod] ||
                    order.paymentMethod ||
                    "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3 text-slate-500">
                  <Package className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase">
                    Số sản phẩm
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {order.items?.length || 0} sản phẩm
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:items-end">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Cập nhật trạng thái đơn hàng
                  </label>
                  <select
                    disabled={updating || isFinalStatus}
                    value={order.status}
                    onChange={(event) => handleStatusChange(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {orderStatuses.map((status) => {
                      const isAllowed = allowedStatuses.includes(status.value);
                      return (
                        <option
                          key={status.value}
                          value={status.value}
                          disabled={!isAllowed}
                        >
                          {status.label}
                          {!isAllowed ? " (không khả dụng)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                    <p className="text-slate-500">Trạng thái hiện tại</p>
                    <p className={`inline-flex items-center gap-2 py-2 text-sm font-bold ${statusConfig.className}`}>
                      <StatusIcon className="h-4 w-4" />
                      {statusConfig.label}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                    <p className="text-slate-500">Trạng thái thanh toán</p>

                    <p
                      className={`inline-flex items-center gap-2 py-2 text-sm font-bold ${paymentConfig.className}`}
                    >
                      <PaymentIcon className="h-4 w-4" />

                      {paymentConfig.label}
                    </p>
                  </div>
                </div>
              </div>

              {order.status === "cancelled" && order.cancellationReason && (
                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-sm font-bold text-red-900">
                    Lý do hủy đơn
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-red-700">
                    {order.cancellationReason}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                {order.completedAt && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Hoàn thành: {formatDateTime(order.completedAt)}
                  </span>
                )}
                {order.cancelledAt && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 font-medium text-red-700">
                    <XCircle className="h-4 w-4" />
                    Hủy: {formatDateTime(order.cancelledAt)}
                  </span>
                )}
                {order.refundedAt && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 font-medium text-rose-700">
                    <RotateCcw className="h-4 w-4" />
                    Hoàn tiền: {formatDateTime(order.refundedAt)}
                  </span>
                )}
              </div>

              {order.paymentStatus === "refunded" && order.refundReason && (
                <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <p className="text-sm font-bold text-rose-900">Lý do hoàn tiền</p>
                  <p className="mt-1 text-sm leading-relaxed text-rose-700">
                    {order.refundReason}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Hoàn tiền cho khách</p>
                  {!refundEligibility.ok && (
                    <p className="mt-0.5 text-xs text-slate-400">{refundEligibility.reason}</p>
                  )}
                </div>
                <span title={!refundEligibility.ok ? refundEligibility.reason : ""}>
                  <button
                    type="button"
                    onClick={() => {
                      setRefundReason("");
                      setShowRefundModal(true);
                    }}
                    disabled={!refundEligibility.ok || refunding}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Hoàn tiền
                  </button>
                </span>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Sản phẩm trong đơn
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Danh sách sản phẩm, biến thể và thành tiền
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {order.items?.length || 0} sản phẩm
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {(order.items || []).map((item) => {
                const productSnapshot = item.productSnapshot;
                const variantSnapshot = item.variantSnapshot;

                const pName = formatProductName(item.productId?.name || productSnapshot?.name) || "Sản phẩm";
                const pImage = item.variantId?.image || item.productId?.images?.[0] || variantSnapshot?.image || productSnapshot?.image;
                const pColor = item.variantId?.color || variantSnapshot?.color || "-";
                const pSize = item.variantId?.size || variantSnapshot?.size || "-";
                const pSku = item.variantId?.sku || variantSnapshot?.sku;
                const isDeleted = !item.productId || item.productId.isDeleted;

                return (
                  <article
                    key={item._id}
                    className={`p-5 transition hover:bg-slate-50/70 ${isDeleted ? "opacity-75" : ""}`}
                  >
                    <div className="flex gap-4">
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                        {pImage ? (
                          <img
                            src={pImage}
                            alt={pName}
                            className={`h-full w-full object-cover ${isDeleted ? "grayscale" : ""}`}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <Package className="h-7 w-7" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-slate-900 flex items-center gap-2">
                              {pName}
                              {isDeleted && (
                                <span className="inline-block shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-600">
                                  Đã ngừng kinh doanh
                                </span>
                              )}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                Màu: {pColor}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                Size: {pSize}
                              </span>
                              {pSku && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                  SKU: {pSku}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-sm text-slate-500">
                              <span className="mr-2">
                                Số lượng:
                              </span>
                              x{item.quantity}
                            </p>
                            <p className="mt-1 text-sm text-slate-900">
                              <span className="mr-2">
                                Đơn giá:
                              </span>
                              {formatCurrency(item.price)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-end rounded-2xl bg-slate-50 px-4 py-3 text-md">
                          <span className="font-bold text-slate-600">
                            Thành tiền:
                          </span>
                          <span className="text-base font-bold text-slate-900 ml-2">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">
              Ghi chú đơn hàng
            </h3>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {order.note?.trim() ? order.note : "Không có ghi chú"}
            </p>
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5">
              <h3 className="text-base font-bold text-slate-900">
                Khách hàng & Giao hàng
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Thông tin người nhận đơn
              </p>
            </div>

            <div className="space-y-4 p-5 text-sm">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                    <User className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">
                      {order.userId?.fullname || order.userId?.username || "-"}
                    </p>
                    <p className="mt-1 break-all text-slate-600">
                      {order.userId?.email || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                    <Phone className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">
                      {order.receiverName || "-"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {order.receiverPhone || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <p className="leading-relaxed text-slate-700">
                    {order.shippingAddress || "-"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5">
              <h3 className="text-base font-bold text-slate-900">Thanh toán</h3>
              <p className="mt-1 text-sm text-slate-500">
                Chi tiết phí và tổng tiền
              </p>
            </div>

            <div className="p-5 text-sm">
              <div className="mb-4 rounded-2xl bg-slate-950 p-4 text-white">
                <div className="flex items-center gap-2 text-slate-300">
                  <Wallet className="h-4 w-4" />
                  <span className="text-xs font-bold">
                    Phương thức thanh toán
                  </span>
                </div>
                <p className="mt-2 text-lg font-bold">
                  {paymentMethodText[order.paymentMethod] ||
                    order.paymentMethod ||
                    "-"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {paymentConfig.label || order.paymentStatus || "-"}
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between text-slate-600">
                  <span>Tạm tính</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(order.subTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Phí vận chuyển</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(order.shippingFee)}
                  </span>
                </div>
                {order.couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Giảm giá SP ({order.couponCode})</span>
                    <span className="font-semibold">
                      -{formatCurrency(order.couponDiscount)}
                    </span>
                  </div>
                )}
                {order.shippingDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Giảm phí ship ({order.shippingCouponCode})</span>
                    <span className="font-semibold">
                      -{formatCurrency(order.shippingDiscount)}
                    </span>
                  </div>
                )}
                {order.discount > 0 && !order.couponDiscount && !order.shippingDiscount && (
                  <div className="flex justify-between text-red-600">
                    <span>Giảm giá</span>
                    <span className="font-semibold">
                      -{formatCurrency(order.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-4 text-base font-bold text-slate-950">
                  <span>Tổng thanh toán</span>
                  <span>{formatCurrency(order.totalPrice)}</span>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Hủy đơn hàng
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Nhập lý do để lưu lịch sử xử lý đơn
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancelModal}
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm leading-relaxed text-slate-700">
                Vui lòng nhập lý do hủy cho đơn hàng
                <span className="font-bold text-slate-900">
                  {" "}
                  #{order._id.slice(-8).toUpperCase()}
                </span>
                .
              </p>

              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                placeholder="Ví dụ: Khách yêu cầu hủy để chỉnh địa chỉ giao hàng"
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                disabled={updating}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {updating ? "Đang xử lý..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Hoàn tiền đơn hàng</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Xác nhận hoàn lại tiền cho khách hàng
                </p>
              </div>
              <button
                type="button"
                onClick={closeRefundModal}
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-rose-900">Số tiền hoàn</span>
                  <span className="text-lg font-bold text-rose-700">
                    {formatCurrency(order.totalPrice)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-rose-600">
                  Đơn #{order._id.slice(-8).toUpperCase()} · Hoàn toàn bộ giá trị đã thanh toán
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Lý do hoàn tiền <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                  rows={4}
                  placeholder="Ví dụ: Khách trả hàng do sản phẩm bị lỗi"
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeRefundModal}
                disabled={refunding}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={confirmRefundOrder}
                disabled={refunding}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {refunding ? "Đang xử lý..." : "Xác nhận hoàn tiền"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
