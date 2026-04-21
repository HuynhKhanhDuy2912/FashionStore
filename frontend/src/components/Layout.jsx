import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const publicNavItems = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" }
];

const privateNavItems = [
  { to: "/recommendations", label: "Recommendations" },
  { to: "/wishlist", label: "Wishlist" },
  { to: "/cart", label: "Cart" },
  { to: "/orders", label: "Orders" }
];

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const isAdminView = location.pathname.startsWith("/admin");
  const isAdminUser = user?.role === "admin";
  const clientNavItems = isAuthenticated
    ? [...publicNavItems, ...privateNavItems]
    : publicNavItems;
  const searchHref = useMemo(
    () => `/products${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`,
    [search]
  );

  return (
    <div className={isAdminView ? "app-shell admin-app-shell" : "app-shell"}>
      {!isAdminView ? (
        <>
          <div className="announcement-bar">FashionStore personalized shopping experience</div>

          <header className="topbar">
            <div className="brand-lockup">
              <span className="brand-mark">FS</span>
              <div>
                <h1>FashionStore</h1>
                <p>Modern fashion storefront</p>
              </div>
            </div>

            <form
              className="header-search"
              onSubmit={(event) => {
                event.preventDefault();
                window.location.href = searchHref;
              }}
            >
              <input
                placeholder="Search shirts, jackets, streetwear..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </form>

            <nav className="nav">
              {clientNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  {item.label}
                </NavLink>
              ))}
              {isAdminUser ? (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  Admin
                </NavLink>
              ) : null}
            </nav>

            <div className="auth-box">
              {isAuthenticated ? (
                <>
                  <div className="account-pill">
                    <span className="account-label">Signed in as</span>
                    <strong>{user?.full_name || user?.username}</strong>
                    <span className={isAdminUser ? "role-badge admin-role-badge" : "role-badge user-role-badge"}>
                      {isAdminUser ? "Admin" : "User"}
                    </span>
                  </div>
                  <button className="ghost-button" onClick={logout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className="nav-link auth-link">
                    Sign in
                  </NavLink>
                  <NavLink to="/register" className="nav-link auth-link">
                    Register
                  </NavLink>
                </>
              )}
            </div>
          </header>
        </>
      ) : null}

      <main className={isAdminView ? "page-wrap admin-page-wrap" : "page-wrap"}>
        <Outlet />
      </main>
    </div>
  );
}
