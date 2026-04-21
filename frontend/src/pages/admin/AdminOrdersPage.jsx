import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const orderStatuses = ["pending", "confirmed", "shipping", "completed", "cancelled"];

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOrders = async () => {
    try {
      const response = await apiRequest("/orders/admin/all", { token });
      setOrders(response.data);
    } catch (loadError) {
      setError(loadError.message);
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
      setMessage("Order status updated");
      loadOrders();
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  return (
    <section>
      <AdminPageHeader title="Orders" description="Review incoming orders and update their lifecycle." />
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <section className="card admin-panel">
        <div className="stack compact">
          {orders.map((order) => (
            <div key={order._id} className="admin-list-row admin-order-row">
              <div>
                <strong>{order.userId?.full_name || order.userId?.username}</strong>
                <p className="muted">
                  {order.receiverName} · {order.receiverPhone}
                </p>
                <p className="muted">{order.shippingAddress}</p>
              </div>
              <div className="admin-order-meta">
                <span>{order.totalPrice?.toLocaleString("vi-VN")} VND</span>
                <select
                  value={order.status}
                  onChange={(event) => updateStatus(order._id, event.target.value)}
                >
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
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
