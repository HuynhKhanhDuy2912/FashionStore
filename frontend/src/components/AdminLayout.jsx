import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Mail,
  MessageSquare,
  Plus,
  Search,
  ShoppingCart,
  Shirt,
  Users,
  Package,
  Warehouse,
  History,
  Ruler,
  MessageCircleQuestion,
  Ticket,
  UserCog,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { NotificationProvider } from "../context/NotificationContext.jsx";
import AdminContactInboxButton from "./AdminContactInboxButton.jsx";
import AdminNotificationBell from "./AdminNotificationBell.jsx";
import { getAvatarInitial, getUserDisplayName } from "../lib/avatar.js";
import ConfirmModal from "./ConfirmModal.jsx";

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
  {
    label: "Tồn kho",
    icon: Package,
    basePath: "/admin/inventory",
    children: [
      { to: "/admin/inventory", label: "Quản lý tồn kho", icon: Warehouse, end: true },
      { to: "/admin/inventory/history", label: "Lịch sử", icon: History },
    ],
  },
  { to: "/admin/orders", label: "Đơn hàng", icon: ShoppingCart },
  { to: "/admin/coupons", label: "Mã giảm giá", icon: Ticket },
  { to: "/admin/users", label: "Người dùng", icon: Users },
  { to: "/admin/reviews", label: "Đánh giá", icon: MessageSquare },
  { to: "/admin/product-questions", label: "Câu hỏi", icon: MessageCircleQuestion },
  { to: "/admin/contact-messages", label: "Liên hệ", icon: Mail },
  { to: "/admin/banners", label: "Banner", icon: Image },
  { to: "/admin/size-guides", label: "Bảng size", icon: Ruler },
];

const utilityNavItems = [
  { to: "/", label: "Về trang chủ", icon: Home },
];

const adminSearchTargets = [
  {
    label: "Sản phẩm",
    description: "Tìm theo tên, danh mục, phong cách",
    path: "/admin/products/list",
    icon: Shirt,
    keywords: ["product", "san pham", "hang hoa", "ao", "quan"],
  },
  {
    label: "Đơn hàng",
    description: "Tìm mã đơn, khách hàng, số điện thoại",
    path: "/admin/orders",
    icon: ShoppingCart,
    keywords: ["order", "don hang", "khach hang", "thanh toan"],
  },
  {
    label: "Người dùng",
    description: "Tìm tên, email, số điện thoại",
    path: "/admin/users",
    icon: Users,
    keywords: ["user", "nguoi dung", "tai khoan", "email"],
  },
  {
    label: "Danh mục",
    description: "Tìm cấu trúc danh mục sản phẩm",
    path: "/admin/categories",
    icon: FolderTree,
    keywords: ["category", "danh muc", "loai san pham"],
  },
  {
    label: "Tồn kho",
    description: "Tìm sản phẩm, SKU, màu, size",
    path: "/admin/inventory",
    icon: Warehouse,
    keywords: ["inventory", "ton kho", "sku", "kho"],
  },
  {
    label: "Mã giảm giá",
    description: "Tìm coupon, voucher, ưu đãi",
    path: "/admin/coupons",
    icon: Ticket,
    keywords: ["coupon", "voucher", "ma giam gia", "uu dai"],
  },
  {
    label: "Đánh giá",
    description: "Tìm nội dung bình luận",
    path: "/admin/reviews",
    icon: MessageSquare,
    keywords: ["review", "danh gia", "binh luan"],
  },
  {
    label: "Câu hỏi sản phẩm",
    description: "Tìm câu hỏi của khách hàng",
    path: "/admin/product-questions",
    icon: MessageCircleQuestion,
    keywords: ["question", "cau hoi", "hoi dap"],
  },
  {
    label: "Liên hệ",
    description: "Tìm tên, email, mã yêu cầu",
    path: "/admin/contact-messages",
    icon: Mail,
    keywords: ["contact", "lien he", "yeu cau", "tin nhan"],
  },
  {
    label: "Bộ sưu tập",
    description: "Tìm kiếm bộ sưu tập sản phẩm",
    path: "/admin/collections",
    icon: Layers,
    keywords: ["collection", "bo suu tap", "nhom san pham"],
  },
  {
    label: "Banner",
    description: "Quản lý hình ảnh quảng cáo",
    path: "/admin/banners",
    icon: Image,
    keywords: ["banner", "quang cao", "hinh anh", "slider"],
  },
  {
    label: "Bảng size",
    description: "Cấu hình hướng dẫn chọn size",
    path: "/admin/size-guides",
    icon: Ruler,
    keywords: ["size", "bang size", "kich thuoc", "so do"],
  },
  {
    label: "Lịch sử tồn kho",
    description: "Xem lịch sử nhập, xuất, điều chỉnh kho",
    path: "/admin/inventory/history",
    icon: History,
    keywords: ["history", "lich su kho", "nhap xuat", "giao dich"],
  },
];

function normalizeSearchText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function getAdminSearchTarget(pathname) {
  if (pathname.startsWith("/admin/products")) return adminSearchTargets[0];
  return adminSearchTargets.find((target) => pathname.startsWith(target.path));
}

function NavItemContent({ icon: Icon, label, collapsed, chevron }) {
  return (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      {!collapsed ? (
        <>
          <span className="flex-1 truncate text-left text-xs font-bold uppercase">
            {label}
          </span>
          {chevron}
        </>
      ) : null}
    </>
  );
}

export default function AdminLayout() {
  const auth = useAuth() || {};
  const { user, logout = () => { } } = auth;
  const location = useLocation();
  const navigate = useNavigate();
  const [adminSearch, setAdminSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const searchFormRef = useRef(null);
  const accountMenuRef = useRef(null);
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
    if (location.pathname.startsWith("/admin/inventory")) autoOpen.push("Tồn kho");
    return autoOpen;
  });

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
  const activeSearchTarget = getAdminSearchTarget(location.pathname);

  const filteredSearchTargets = useMemo(() => {
    const keyword = normalizeSearchText(adminSearch.trim());
    if (!keyword) return adminSearchTargets.slice(0, 8);

    return adminSearchTargets
      .map((target) => {
        const haystack = normalizeSearchText(
          [target.label, target.description, ...target.keywords].join(" "),
        );
        const label = normalizeSearchText(target.label);
        const score =
          label.includes(keyword) ? 2 : haystack.includes(keyword) ? 1 : 0;

        return { ...target, score };
      })
      .filter((target) => target.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [adminSearch]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setAdminSearch(params.get("q") || "");
    setIsSearchOpen(false);
    setIsAccountMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchFormRef.current &&
        !searchFormRef.current.contains(event.target)
      ) {
        setIsSearchOpen(false);
      }

      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = (label) => {
    if (collapsed) return;
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 text-xs font-bold uppercase transition-colors ${isActive
      ? "bg-black text-white"
      : "text-gray-500 hover:bg-gray-50 hover:text-black"
    } ${collapsed ? "mx-2 my-0.5 justify-center rounded-lg px-2 py-3" : "px-4 py-3.5"}`;

  const buildSearchPath = (path, keyword) => {
    const query = keyword.trim();
    return query ? `${path}?q=${encodeURIComponent(query)}` : path;
  };

  const runAdminSearch = (target = activeSearchTarget) => {
    const keyword = adminSearch.trim();

    const destination =
      target || filteredSearchTargets[0] || adminSearchTargets[0];
    navigate(buildSearchPath(destination.path, keyword));
    setIsSearchOpen(false);
  };

  const clearAdminSearch = () => {
    setAdminSearch("");
    if (activeSearchTarget) navigate(activeSearchTarget.path);
  };

  return (
    <NotificationProvider>
      <section className="min-h-screen bg-gray-50 font-sans">
        <aside
          style={{ width: sidebarWidth }}
          className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-gray-200 bg-white text-black transition-[width] duration-300 ease-in-out"
        >
          <div className={`flex flex-col justify-center border-b border-gray-200 h-[71px] ${collapsed ? "items-center px-2" : "px-4"}`}>
            {collapsed ? (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-sm font-bold uppercase text-white">
                {getAvatarInitial(user, "A")}
              </div>
            ) : (
              <div className="flex w-full items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-sm font-bold uppercase text-white">
                  {getAvatarInitial(user, "A")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-500">
                    Xin chào,
                  </p>
                  <p className="truncate text-sm font-bold text-black">
                    {getUserDisplayName(user, "Admin")}!
                  </p>
                </div>
              </div>
            )}
          </div>
          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
            {adminNavItems.map((item) => {
              if (item.children) {
                const isOpen = openMenus.includes(item.label);
                const isActive = location.pathname.startsWith(item.basePath);

                if (collapsed) {
                  const collapsedTarget = item.children[0]?.to || item.basePath;
                  return (
                    <NavLink
                      key={item.label}
                      to={collapsedTarget}
                      title={item.label}
                      className={() => linkClass({ isActive })}
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
                      className={`flex w-full items-center gap-2 px-4 py-3.5 text-left text-xs font-bold uppercase transition-colors ${isActive
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
                            end={child.end}
                            title={child.label}
                            className={({ isActive }) =>
                              `flex items-center gap-2 py-3 pl-10 pr-4 text-xs font-bold uppercase transition-colors ${isActive
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
              onClick={() => setIsLogoutModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-3.5 text-left text-xs font-bold uppercase text-red-600 transition hover:bg-gray-50 hover:text-red-500 ${collapsed ? "justify-center px-2" : ""
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
          <header
            style={{ left: sidebarWidth }}
            className="fixed top-0 right-0 z-20 border-b border-gray-200 bg-white shadow-sm transition-[left] duration-300 ease-in-out"
          >
            <div className="relative flex h-[70px] items-center sm:pr-6">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setCollapsed((value) => !value)}
                  className="grid h-6 w-6 shrink-0 place-items-center bg-white text-gray-600 transition hover:border-black hover:text-black"
                  title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
                  aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
                >
                  {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </button>

                <NavLink
                  to="/admin"
                  className="hidden items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50 lg:flex"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center border border-gray-300 bg-white text-sm font-extrabold text-black">
                    FS
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold uppercase tracking-wider text-black">
                      FashionStore
                    </span>
                  </span>
                </NavLink>
              </div>

              <form
                ref={searchFormRef}
                className="absolute left-[72px] right-[92px] max-w-md lg:left-1/2 lg:right-auto lg:w-[min(560px,calc(100%-560px))] lg:min-w-[360px] lg:-translate-x-1/2"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAdminSearch();
                }}
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={adminSearch}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(event) => {
                    setAdminSearch(event.target.value);
                    setIsSearchOpen(true);
                  }}
                  placeholder="Tìm kiếm tất cả danh mục, sản phẩm..."
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-10 text-sm outline-none transition focus:border-black focus:bg-white"
                />
                {adminSearch ? (
                  <button
                    type="button"
                    onClick={clearAdminSearch}
                    className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-black"
                    aria-label="Xóa tìm kiếm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}

                {isSearchOpen ? (
                  <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    {adminSearch.trim() && activeSearchTarget ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => runAdminSearch(activeSearchTarget)}
                        className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50"
                      >
                        <Search className="h-4 w-4 text-black" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-black">
                            Tìm "{adminSearch.trim()}" trong {activeSearchTarget.label}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            Áp dụng bộ lọc cho trang hiện tại
                          </p>
                        </div>
                      </button>
                    ) : null}

                    <div className="max-h-[320px] overflow-y-auto py-1">
                      {filteredSearchTargets.length > 0 ? (
                        filteredSearchTargets.map((target) => {
                          const Icon = target.icon;
                          return (
                            <button
                              key={target.path}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => runAdminSearch(target)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-black">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-black">
                                  {target.label}
                                </span>
                                <span className="block truncate text-xs text-gray-500">
                                  {target.description}
                                </span>
                              </span>
                              <ChevronRight className="h-4 w-4 text-gray-300" />
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">
                          Không tìm thấy khu vực phù hợp
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </form>

              <div className="ml-auto flex items-center gap-2">
                <AdminContactInboxButton />

                <AdminNotificationBell />

                <div className="relative ml-1" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen((current) => !current)}
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1.5 transition hover:border-black"
                    aria-label="Mở menu tài khoản admin"
                    aria-expanded={isAccountMenuOpen}
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-black text-xs font-bold uppercase text-white">
                      {getAvatarInitial(user, "A")}
                    </div>
                    <div className="hidden min-w-0 pr-1 text-left sm:block">
                      <div className="truncate text-xs font-bold text-black">
                        {getUserDisplayName(user, "Admin")}
                      </div>
                      <div className="truncate text-[11px] text-gray-500">Quản trị viên</div>
                    </div>
                    <ChevronDown
                      className={`hidden h-4 w-4 text-gray-400 transition-transform sm:block ${isAccountMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isAccountMenuOpen ? (
                    <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                      <div className="border-b border-gray-100 bg-gray-50 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black text-sm font-bold uppercase text-white">
                            {getAvatarInitial(user, "A")}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-black">
                              {getUserDisplayName(user, "Admin")}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {user?.email || "Quản trị viên"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="py-2">
                        <NavLink
                          to="/admin/account"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-black"
                        >
                          <UserCog className="h-4 w-4" />
                          Tài khoản quản trị
                        </NavLink>
                        <NavLink
                          to="/"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-black"
                        >
                          <Home className="h-4 w-4" />
                          Về cửa hàng
                        </NavLink>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            setIsLogoutModalOpen(true);
                          }}
                          className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <div className="pt-[65px]">
            <Outlet />
          </div>
        </main>
      </section>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={logout}
        title="Đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất không?"
        confirmText="Đăng xuất"
      />
    </NotificationProvider>
  );
}
