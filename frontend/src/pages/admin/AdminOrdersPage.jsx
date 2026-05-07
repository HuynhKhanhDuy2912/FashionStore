import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import toast from "react-hot-toast";

const orderStatuses = [
  { value: "pending", label: "CHỜ XÁC NHẬN" },
  { value: "confirmed", label: "ĐÃ XÁC NHẬN" },
  { value: "shipping", label: "ĐANG GIAO HÀNG" },
  { value: "completed", label: "HOÀN THÀNH" },
  { value: "cancelled", label: "ĐÃ HỦY" }
];

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);

  const loadOrders = async () => {
    try {
      const response = await apiRequest("/orders/admin/all", { token });
      setOrders(response.data);
    } catch (loadError) {
      toast.error(loadError.message);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  const updateStatus = async (orderId, status) => {
    try {
      await apiRequest(`/orders/admin/${orderId}/status`, {
        method: "PATCH",
        token,
        body: { status }
      });
      toast.success("Đã cập nhật trạng thái đơn hàng");
      loadOrders();
    } catch (updateError) {
      toast.error(updateError.message);
    }
  };

  return (
    <section className="grid gap-6">
      <AdminPageHeader title="ĐƠN HÀNG" description="Quản lý và cập nhật trạng thái đơn hàng." />
      <section className="bg-white border border-gray-200 p-7">
        <h3 className="text-black text-sm m-0 mb-6 pb-4 border-b border-gray-200 font-bold uppercase tracking-widest">DANH SÁCH ĐƠN HÀNG</h3>
        <div className="grid gap-0 divide-y divide-gray-100">
          {orders.map((order) => (
            <div key={order._id} className="flex justify-between gap-4 py-4 items-center hover:bg-gray-50 transition-colors px-2">
              <div>
                <strong className="block text-black mb-1 text-sm">{order.userId?.full_name || order.userId?.username}</strong>
                <p className="m-0 text-xs text-gray-500 mb-1 uppercase tracking-widest">
                  <span className="font-bold text-black">Người nhận:</span> {order.receiverName} · {order.receiverPhone}
                </p>
                <p className="m-0 text-xs text-gray-500 uppercase tracking-widest">
                  <span className="font-bold text-black">Địa chỉ:</span> {order.shippingAddress}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 shrink-0">
                <span className="font-bold text-black text-sm">{order.totalPrice?.toLocaleString("vi-VN")} ₫</span>
                <select
                  className="border border-gray-300 px-3 py-2 bg-white text-black font-bold uppercase tracking-widest transition-colors text-xs focus:border-black focus:outline-none cursor-pointer"
                  value={order.status}
                  onChange={(event) => updateStatus(order._id, event.target.value)}
                >
                  {orderStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
