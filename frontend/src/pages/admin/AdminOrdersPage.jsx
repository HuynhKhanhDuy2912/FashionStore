import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock3,
  Search,
  Truck,
  Wallet,
  X,
  XCircle,
  Filter,
} from "lucide-react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import toast from "react-hot-toast";

const orderStatuses = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

const paymentMethods = [
  { value: "all", label: "Tất cả" },
  { value: "cod", label: "COD" },
  { value: "vnpay", label: "VNPay" },
  { value: "momo", label: "MoMo" },
  { value: "paypal", label: "PayPal" },
];

const paymentStatusText = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán thất bại",
};

const statusMap = {
  pending: {
    label: "Chờ xác nhận",
    className: "border-yellow-200 bg-yellow-50 text-yellow-700",
    icon: Clock3,
  },
  confirmed: {
    label: "Đã xác nhận",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: CheckCircle2,
  },
  shipping: {
    label: "Đang giao",
    className: "border-purple-200 bg-purple-50 text-purple-700",
    icon: Truck,
  },
  completed: {
    label: "Hoàn thành",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Đã hủy",
    className: "border-gray-200 bg-gray-100 text-gray-700",
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

const formatCurrency = (value) => `${(value || 0).toLocaleString("vi-VN")} ₫`;

export default function AdminOrdersPage() {
  const { token } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest("/orders/admin/all", { token });
      setOrders(response.data || []);
    } catch (requestError) {
      setError(requestError.message || "Không thể tải danh sách đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (searchTerm.trim()) {
      const keyword = searchTerm.trim().toLowerCase();
      result = result.filter((order) => {
        const customerName = (
          order.userId?.full_name ||
          order.userId?.username ||
          ""
        ).toLowerCase();
        const receiverName = (order.receiverName || "").toLowerCase();
        const receiverPhone = (order.receiverPhone || "").toLowerCase();
        return (
          order._id.toLowerCase().includes(keyword) ||
          order._id.slice(-8).toLowerCase().includes(keyword) ||
          customerName.includes(keyword) ||
          receiverName.includes(keyword) ||
          receiverPhone.includes(keyword)
        );
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter);
    }

    if (paymentMethodFilter !== "all") {
      result = result.filter(
        (order) => order.paymentMethod === paymentMethodFilter,
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((order) => new Date(order.createdAt) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((order) => new Date(order.createdAt) <= to);
    }

    return result;
  }, [orders, searchTerm, statusFilter, paymentMethodFilter, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPaymentMethodFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const submitStatusUpdate = async (
    orderId,
    status,
    cancellationReason = "",
  ) => {
    try {
      setUpdatingOrderId(orderId);
      await apiRequest(`/orders/admin/${orderId}/status`, {
        method: "PATCH",
        token,
        body: {
          status,
          cancellationReason,
        },
      });
      toast.success("Cập nhật trạng thái đơn hàng thành công");
      await loadOrders();
    } catch (requestError) {
      toast.error(requestError.message || "Cập nhật trạng thái thất bại");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStatusChange = (order, nextStatus) => {
    if (order.status === nextStatus) return;

    if (nextStatus === "cancelled") {
      setCancelTarget(order);
      setCancelReason("");
      setShowCancelModal(true);
      return;
    }

    submitStatusUpdate(order._id, nextStatus);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelTarget(null);
    setCancelReason("");
  };

  const confirmCancelOrder = async () => {
    if (!cancelTarget) return;

    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Vui lòng nhập lý do hủy đơn hàng");
      return;
    }

    await submitStatusUpdate(cancelTarget._id, "cancelled", reason);
    closeCancelModal();
  };

  return (
    <section className="grid gap-6 p-6">
      <AdminPageHeader
        title="Quản lý đơn hàng"
        description="Theo dõi, tìm kiếm và xử lý đơn hàng với đầy đủ thông tin thanh toán, vận chuyển."
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-2 block text-xs font-semibold text-gray-500">
              Tìm kiếm đơn hàng
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Mã đơn, tên khách, số điện thoại người nhận"
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-black"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className=" flex mb-2 block gap-2 text-xs font-semibold text-gray-500">
              <Filter className="h-4 w-4" />Trạng thái đơn
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              <option value="all">Tất cả trạng thái</option>
              {orderStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="flex mb-2 block gap-2 text-xs font-semibold text-gray-500">
              <Filter className="h-4 w-4" /> Phương thức thanh toán
            </label>
            <select
              value={paymentMethodFilter}
              onChange={(event) => setPaymentMethodFilter(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="flex mb-2 block gap-2 text-xs font-semibold text-gray-500">
              <Filter className="h-4 w-4" /> Ngày tạo đơn
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2.5 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full outline-none"
              />
            </label>
          </div>

          <div className="lg:col-span-2">
            <label className="flex mb-2 block gap-2 text-xs font-semibold text-gray-500">
              <Filter className="h-4 w-4" /> Ngày hoàn thành
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2.5 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full outline-none"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <div className="text-sm text-gray-600">
            Có{" "}
            <span className="font-semibold text-black">
              {filteredOrders.length}
            </span>{" "}
            đơn hàng phù hợp bộ lọc
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Xóa bộ lọc
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase text-gray-500 text-center">
                <th className="px-6 py-4">Mã đơn</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4">Người nhận</th>
                <th className="px-6 py-4">Thanh toán</th>
                <th className="px-6 py-4">Trạng thái đơn</th>
                <th className="px-6 py-4">Tổng tiền</th>
                <th className="px-6 py-4">Cập nhật</th>
                <th className="px-6 py-4">Hành động</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-gray-500" colSpan={8}>
                    Đang tải danh sách đơn hàng...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-gray-500" colSpan={8}>
                    Không có đơn hàng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const statusConfig =
                    statusMap[order.status] || statusMap.pending;
                  const StatusIcon = statusConfig.icon;

                  const allowedStatuses = getAllowedStatuses(order.status);

                  return (
                    <tr
                      key={order._id}
                      className="align-top transition hover:bg-gray-50/80 text-center"
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-black">
                          #{order._id.slice(-8).toUpperCase()}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDateTime(order.createdAt)}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700">
                        <p className="font-medium text-gray-900">
                          {order.userId?.full_name ||
                            order.userId?.username ||
                            "-"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.userId?.email || "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700">
                        <p className="font-medium text-gray-900">
                          {order.receiverName || "-"}
                        </p>
                        <p>{order.receiverPhone || "-"}</p>
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                          <Wallet className="h-3.5 w-3.5" />
                          {order.paymentMethod?.toUpperCase() || "-"}
                        </div>
                        <p className="mt-2 text-xs text-gray-600">
                          {paymentStatusText[order.paymentStatus] ||
                            order.paymentStatus ||
                            "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusConfig.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusConfig.label}
                        </span>
                        {order.status === "cancelled" &&
                          order.cancellationReason && (
                            <p className="mt-2 max-w-[260px] text-xs text-red-600">
                              Lý do: {order.cancellationReason}
                            </p>
                          )}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-black">
                        {formatCurrency(order.totalPrice)}
                      </td>

                      <td className="px-6 py-4">
                        <select
                          disabled={updatingOrderId === order._id}
                          value={order.status}
                          onChange={(event) =>
                            handleStatusChange(order, event.target.value)
                          }
                          className="w-[120px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium outline-none transition focus:border-black disabled:cursor-not-allowed disabled:bg-gray-100"
                        >
                          {orderStatuses
                            .filter((status) =>
                              allowedStatuses.includes(status.value),
                            )
                            .map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                        </select>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/orders/${order._id}`}
                          className="inline-flex rounded-lg border border-black px-3 py-2 text-xs font-semibold text-black transition hover:bg-black hover:text-white"
                        >
                          Xem chi tiết
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-base font-bold text-gray-900">
                Hủy đơn hàng
              </h3>
              <button
                type="button"
                onClick={closeCancelModal}
                className="text-gray-500 transition hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-gray-700">
                Vui lòng nhập lý do hủy cho đơn hàng
                <span className="font-semibold">
                  {" "}
                  #{cancelTarget?._id?.slice(-8)?.toUpperCase()}
                </span>
                .
              </p>

              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                placeholder="Ví dụ: Khách yêu cầu hủy để chỉnh địa chỉ giao hàng"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-black"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
