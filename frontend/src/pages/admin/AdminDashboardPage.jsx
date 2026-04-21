import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchAdminBundle } from "../../lib/admin.js";

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAdminBundle(token);
        setBundle(data);
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    load();
  }, [token]);

  const summaryCards = bundle
    ? [
        { label: "Users", value: bundle.users.length },
        { label: "Categories", value: bundle.categories.length },
        { label: "Products", value: bundle.products.length },
        { label: "Variants", value: bundle.variants.length },
        { label: "Outfits", value: bundle.outfits.length },
        { label: "Orders", value: bundle.orders.length }
      ]
    : [];

  const statusGroups = bundle
    ? bundle.orders.reduce((accumulator, order) => {
        accumulator[order.status] = (accumulator[order.status] || 0) + 1;
        return accumulator;
      }, {})
    : {};

  const topStyles = bundle
    ? bundle.products.reduce((accumulator, product) => {
        accumulator[product.style] = (accumulator[product.style] || 0) + 1;
        return accumulator;
      }, {})
    : {};

  return (
    <section>
      <AdminPageHeader
        title="Dashboard"
        description="A quick operational overview of the seeded fashion commerce system."
      />
      {error ? <p className="error-text">{error}</p> : null}
      <div className="admin-stats-grid">
        {summaryCards.map((item) => (
          <article key={item.label} className="admin-stat-card">
            <span>{item.value}</span>
            <p>{item.label}</p>
          </article>
        ))}
      </div>

      {bundle ? (
        <div className="admin-grid-two">
          <section className="card admin-panel">
            <h3>Recent orders</h3>
            <div className="stack compact">
              {bundle.orders.slice(0, 5).map((order) => (
                <div key={order._id} className="admin-list-row">
                  <div>
                    <strong>{order.userId?.full_name || order.userId?.username}</strong>
                    <p className="muted">{order.status}</p>
                  </div>
                  <span>{order.totalPrice?.toLocaleString("vi-VN")} VND</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card admin-panel">
            <h3>Low stock variants</h3>
            <div className="stack compact">
              {bundle.variants
                .filter((item) => item.stock <= 10)
                .slice(0, 5)
                .map((variant) => (
                  <div key={variant._id} className="admin-list-row">
                    <div>
                      <strong>{variant.productId?.name || "Variant"}</strong>
                      <p className="muted">
                        {variant.color} / {variant.size}
                      </p>
                    </div>
                    <span>{variant.stock}</span>
                  </div>
                ))}
            </div>
          </section>
        </div>
      ) : null}

      {bundle ? (
        <div className="admin-grid-two">
          <section className="card admin-panel">
            <h3>Order status breakdown</h3>
            <div className="stack compact">
              {Object.entries(statusGroups).map(([status, count]) => (
                <div key={status} className="admin-list-row">
                  <strong>{status}</strong>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card admin-panel">
            <h3>Catalog style mix</h3>
            <div className="stack compact">
              {Object.entries(topStyles).map(([style, count]) => (
                <div key={style} className="admin-list-row">
                  <strong>{style}</strong>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
