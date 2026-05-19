import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  Home,
  Image,
  Layers,
  LayoutDashboard,
  List,
  LogOut,
  Plus,
  ShoppingBag,
  Shirt,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 76;
const STORAGE_KEY = "fashionstore-admin-sidebar-collapsed";

const adminNavItems = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { to: "/admin/collections", label: "Bộ sưu tập", icon: Layers },
  {
    label: "Sản phẩm",
    icon: Shirt,
    basePath: "/admin/products",
    children: [
      { to: "/admin/products/list", label: "Danh sách", icon: List },
      { to: "/admin/products/add", label: "Thêm mới", icon: Plus },
    ],
  },
  { to: "/admin/users", label: "Người dùng", icon: Users },
  { to: "/admin/orders", label: "Đơn hàng", icon: ShoppingBag },
  { to: "/admin/banners", label: "Banner", icon: Image },
];

const utilityNavItems = [
  { to: "/", label: "Về trang chủ", icon: Home },
];

function NavItemContent({ icon: Icon, label, collapsed, chevron }) {
  return (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      {!collapsed ? (
        <>
          <span className="flex-1 truncate text-left text-xs font-bold uppercase tracking-widest">
            {label}
          </span>
          {chevron}
        </>
      ) : null}
    </>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [openMenus, setOpenMenus] = useState(() => {
    const autoOpen = [];
    if (location.pathname.startsWith("/admin/products")) autoOpen.push("Sản phẩm");
    return autoOpen;
  });

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleMenu = (label) => {
    if (collapsed) return;
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const linkClass = ({ isActive }) =>
    `mx-0 flex items-center gap-2 px-4 py-3.5 text-xs font-bold uppercase tracking-widest transition-colors ${isActive
      ? "bg-black text-white"
      : "text-gray-500 hover:bg-gray-50 hover:text-black"
    } ${collapsed ? "justify-center px-2" : ""}`;

  return (
    <section className="min-h-screen bg-gray-50 font-sans">
      <aside
        style={{ width: sidebarWidth }}
        className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-gray-200 bg-white text-black transition-[width] duration-300 ease-in-out"
      >
        <div className={`flex shrink-0 border-b border-gray-200 ${collapsed ? "flex-col items-center gap-2 py-3" : "items-center gap-2 px-4 py-5"}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center bg-black text-sm font-extrabold tracking-widest text-white">
            FS
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Trang quản trị
              </span>
              <h2 className="m-0 truncate text-sm font-bold uppercase tracking-widest">
                FashionStore
              </h2>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={`grid h-8 w-8 shrink-0 place-items-center border border-gray-300 text-gray-600 transition hover:border-black hover:text-black ${collapsed ? "" : "ml-auto"
              }`}
            title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed ? (
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center border border-gray-300 bg-gray-100 text-xs font-bold uppercase">
              {(user?.full_name || user?.username || "A").slice(0, 1)}
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-xs uppercase tracking-widest">
                {user?.full_name || user?.username}
              </strong>
              <span className="block truncate text-[10px] text-gray-500">
                {user?.email || "Quản trị viên"}
              </span>
            </div>
          </div>
        ) : (
          <div
            className="mx-auto my-3 grid h-8 w-8 place-items-center border border-gray-300 bg-gray-100 text-xs font-bold uppercase"
            title={user?.full_name || user?.username}
          >
            {(user?.full_name || user?.username || "A").slice(0, 1)}
          </div>
        )}

        <nav className="mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
          {adminNavItems.map((item) => {
            if (item.children) {
              const isOpen = openMenus.includes(item.label);
              const isActive = location.pathname.startsWith(item.basePath);

              if (collapsed) {
                return (
                  <NavLink
                    key={item.label}
                    to="/admin/products/list"
                    title={item.label}
                    className={linkClass}
                  >
                    <NavItemContent icon={item.icon} label={item.label} collapsed />
                  </NavLink>
                );
              }

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.label)}
                    title={item.label}
                    className={`flex w-full items-center gap-2 px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest transition-colors ${isActive
                        ? "bg-black text-white"
                        : "text-gray-500 hover:bg-gray-50 hover:text-black"
                      }`}
                  >
                    <NavItemContent
                      icon={item.icon}
                      label={item.label}
                      collapsed={false}
                      chevron={
                        <ChevronDown
                          size={14}
                          className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      }
                    />
                  </button>
                  {isOpen ? (
                    <div className="border-y border-gray-100 bg-gray-50">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          title={child.label}
                          className={({ isActive }) =>
                            `flex items-center gap-2 py-3 pl-10 pr-4 text-xs font-bold uppercase tracking-widest transition-colors ${isActive
                              ? "border-l-4 border-black bg-gray-200 text-black"
                              : "border-l-4 border-transparent text-gray-500 hover:bg-gray-100 hover:text-black"
                            }`
                          }
                        >
                          <child.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                className={linkClass}
              >
                <NavItemContent icon={item.icon} label={item.label} collapsed={collapsed} />
              </NavLink>
            );
          })}

          <div className={`my-2 border-t border-gray-200 ${collapsed ? "mx-2" : "mx-4"}`} />

          {utilityNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={linkClass}
            >
              <NavItemContent icon={item.icon} label={item.label} collapsed={collapsed} />
            </NavLink>
          ))}

          <button
            type="button"
            title="Đăng xuất"
            onClick={logout}
            className={`flex items-center gap-2 px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-50 hover:text-red-600 ${collapsed ? "justify-center px-2" : ""
              }`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center">
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            {!collapsed ? <span>Đăng xuất</span> : null}
          </button>
        </nav>
      </aside>

      <main
        style={{ marginLeft: sidebarWidth }}
        className="min-h-screen bg-gray-50 transition-[margin-left] duration-300 ease-in-out"
      >
        <Outlet />
      </main>
    </section>
  );
}
