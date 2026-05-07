import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ChevronDown } from "lucide-react";

const adminNavItems = [
  { to: "/admin", label: "TỔNG QUAN", end: true },
  { to: "/admin/categories", label: "DANH MỤC" },
  {
    label: "SẢN PHẨM",
    basePath: "/admin/products",
    children: [
      { to: "/admin/products/list", label: "Danh sách sản phẩm" },
      { to: "/admin/products/add", label: "Thêm sản phẩm mới" }
    ]
  },
  { to: "/admin/users", label: "NGƯỜI DÙNG" },
  { to: "/admin/orders", label: "ĐƠN HÀNG" }
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState(() => {
    // Auto-open if currently on a products sub-route
    return location.pathname.startsWith("/admin/products") ? ["SẢN PHẨM"] : [];
  });

  const toggleMenu = (label) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  return (
    <section className="grid grid-cols-[240px_1fr] min-h-screen bg-gray-50 font-sans">
      <aside className="self-start sticky top-0 bg-white p-0 text-black min-h-screen border-r border-gray-200 z-20 flex flex-col">
        <div className="mb-4 p-6 border-b border-gray-200">
          <div className="flex gap-3 items-center mb-6">
            <span className="w-10 h-10 bg-black text-white grid place-items-center font-extrabold text-sm tracking-widest uppercase">FS</span>
            <div>
              <span className="text-gray-500 text-[10px] tracking-widest uppercase block mb-0.5">TRANG QUẢN TRỊ</span>
              <h2 className="text-sm m-0 font-bold uppercase tracking-widest">FASHIONSTORE</h2>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 grid place-items-center bg-gray-100 border border-gray-300 font-bold text-xs uppercase">
              {(user?.full_name || user?.username || "A").slice(0, 1)}
            </div>
            <div>
              <strong className="block text-xs uppercase tracking-widest">{user?.full_name || user?.username}</strong>
            </div>
          </div>
        </div>

        <nav className="flex flex-col">
          {adminNavItems.map((item) => {
            if (item.children) {
              const isOpen = openMenus.includes(item.label);
              const isActive = location.pathname.startsWith(item.basePath);

              return (
                <div key={item.label}>
                  {/* Parent button */}
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer border-none ${
                      isActive
                        ? "bg-black text-white"
                        : "bg-white text-gray-500 hover:text-black hover:bg-gray-50"
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Dropdown children */}
                  {isOpen && (
                    <div className="bg-gray-50 border-y border-gray-100">
                      {item.children.map(child => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            `block pl-10 pr-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                              isActive
                                ? "text-black bg-gray-200 border-l-4 border-black"
                                : "text-gray-500 hover:text-black hover:bg-gray-100 border-l-4 border-transparent"
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${
                    isActive
                      ? "bg-black text-white"
                      : "text-gray-500 hover:text-black hover:bg-gray-50"
                  }`
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto p-6 border-t border-gray-200">
          <div className="flex flex-col gap-2">
            <NavLink
              to="/"
              className="flex items-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-black border border-black hover:bg-black hover:text-white transition-colors justify-center"
            >
              VỀ TRANG CHỦ
            </NavLink>
            <button
              className="flex items-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600 border border-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer justify-center w-full"
              onClick={logout}
            >
              ĐĂNG XUẤT
            </button>
          </div>
        </div>
      </aside>

      <div className="bg-gray-50 min-h-screen">
        <Outlet />
      </div>
    </section>
  );
}
