import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const adminNavItems = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/product-images", label: "Product Images" },
  { to: "/admin/variants", label: "Variants" },
  { to: "/admin/outfits", label: "Outfits" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/orders", label: "Orders" }
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-top">
            <span className="admin-logo-mark">FS</span>
            <div>
              <span className="eyebrow admin-eyebrow">Admin panel</span>
              <h2>FashionStore</h2>
            </div>
          </div>
          <div className="admin-profile-card">
            <div className="admin-avatar-circle">
              {(user?.full_name || user?.username || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{user?.full_name || user?.username}</strong>
              <p>Administrator</p>
            </div>
          </div>
        </div>
        <nav className="admin-nav">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "admin-nav-link active" : "admin-nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-actions">
            <NavLink to="/" className="admin-secondary-link">
              Ve storefront
            </NavLink>
            <button className="admin-logout-button" onClick={logout}>
              Dang xuat
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </section>
  );
}
