import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  History,
  IdCard,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Shirt,
  Store,
  Truck,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { apiRequest } from "../lib/api.js";
import { getAvatarInitial, getUserDisplayName } from "../lib/avatar.js";
import ConfirmModal from "./ConfirmModal.jsx";

function getParentId(category) {
  if (!category?.parentId) return null;
  return typeof category.parentId === "string"
    ? category.parentId
    : category.parentId._id || null;
}

function sortByCreatedAt(items) {
  return [...items].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  );
}

function distributeIntoColumns(items, columnCount = 4) {
  if (items.length === 0) return [];
  const cols = Math.min(columnCount, items.length);
  const result = Array.from({ length: cols }, () => []);
  const perCol = Math.ceil(items.length / cols);
  items.forEach((item, i) => {
    const colIndex = Math.floor(i / perCol);
    result[Math.min(colIndex, cols - 1)].push(item);
  });
  return result;
}

const highlightItems = [
  { key: "all", label: "Tất cả sản phẩm", type: "all" },
  { key: "new", label: "Hàng Mới", type: "new" },
  { key: "sale", label: "Ưu đãi", type: "sale" },
  { key: "best-seller", label: "Bán Chạy", type: "hot" }
];

const footerShopLinks = [
  { label: "Tất cả sản phẩm", to: "/products" },
  { label: "Hàng mới về", to: "/products?newArrivals=1" },
  { label: "Bán chạy", to: "/products?bestSeller=1" },
  { label: "Ưu đãi", to: "/products?sale=1" },
  { label: "Bộ sưu tập", to: "/collections" },
];

const footerSupportLinks = [
  { label: "Tài khoản của tôi", to: "/profile" },
  { label: "Theo dõi đơn hàng", to: "/profile?tab=orders" },
  { label: "Gợi ý cho bạn", to: "/recommendations" },
  { label: "Ưu đãi của tôi", to: "/profile?tab=coupons" },
  { label: "Liên hệ hỗ trợ", to: "/contact" },
];

const footerPolicyLinks = [
  "Chính sách đổi trả",
  "Chính sách vận chuyển",
  "Bảo mật thông tin",
  "Điều khoản mua hàng",
];

const footerServiceItems = [
  {
    icon: Truck,
    title: "Giao hàng toàn quốc",
    copy: "Miễn phí từ 999.000đ",
  },
  {
    icon: RotateCcw,
    title: "Đổi trả 30 ngày",
    copy: "Linh hoạt, rõ ràng",
  },
  {
    icon: ShieldCheck,
    title: "Thanh toán an toàn",
    copy: "COD, VNPay, PayPal",
  },
  {
    icon: MessageCircle,
    title: "Tư vấn nhanh",
    copy: "Hỗ trợ chọn size",
  },
];

function InstagramLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function TikTokLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.7 3c.28 2.38 1.62 3.8 3.95 3.95v3.08a7.5 7.5 0 0 1-3.88-.95v5.79c0 7.36-8.02 9.65-11.25 4.38-2.08-3.39-.8-9.35 5.87-9.59v3.25c-.49.08-1.02.21-1.5.38-1.45.49-2.27 1.41-2.04 3.04.44 3.12 6.16 4.05 5.68-2.06V3h3.17Z" />
    </svg>
  );
}

function FacebookLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.25 10.44 22v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.91 3.77-3.91 1.1 0 2.24.2 2.24.2V8.6h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.25 22 17.08 22 12.06Z" />
    </svg>
  );
}

const footerSocials = [
  { label: "Instagram", icon: InstagramLogo, href: "https://www.instagram.com/khanhduy.2912?igsh=MTl1d3J2NGx0cXg3eQ==" },
  { label: "TikTok", icon: TikTokLogo, href: "https://www.tiktok.com/@khanhduy291204" },
  { label: "Facebook", icon: FacebookLogo, href: "https://www.facebook.com/share/1PtKjq2TYg/" },
];

function HighlightIcon({ type }) {
  if (type === "new") {
    return (
      <div className="grid h-10 w-10 place-items-center bg-[#389E0D] text-[11px] font-bold uppercase text-white">
        NEW
      </div>
    );
  }

  if (type === "sale") {
    return (
      <div className="grid h-10 w-10 place-items-center bg-[#F7811E] text-[11px] font-bold uppercase text-white">
        SALE
      </div>
    );
  }

  if (type === "hot") {
    return (
      <div className="grid h-10 w-10 place-items-center bg-[#F41C11] text-[11px] font-bold uppercase text-white">
        HOT
      </div>
    );
  }

  return (
    <div className="grid h-10 w-10 place-items-center bg-[#2563EB] text-[11px] font-bold uppercase text-white">
      ALL
    </div>
  );
}

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  const { cartCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const accountRef = useRef(null);
  const megaPanelRef = useRef(null);
  const megaTriggerRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const [search, setSearch] = useState("");
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const isAdminView = location.pathname.startsWith("/admin");
  const isAdminUser = user?.role === "admin";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  const searchHref = useMemo(
    () =>
      `/products${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`,
    [search],
  );

  useEffect(() => {
    setActiveMegaMenu(null);
    setSearch("");
  }, [location.pathname, location.search]);

  const loadCategories = useCallback(() => {
    apiRequest("/categories?limit=1000")
      .then((response) => setCategories(response.data || []))
      .catch(() => { });
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const handleCategoriesChanged = () => loadCategories();

    window.addEventListener("categories:changed", handleCategoriesChanged);
    window.addEventListener("focus", handleCategoriesChanged);

    return () => {
      window.removeEventListener("categories:changed", handleCategoriesChanged);
      window.removeEventListener("focus", handleCategoriesChanged);
    };
  }, [loadCategories]);

  useEffect(() => {
    const handleClick = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setIsAccountOpen(false);
      }

      if (!activeMegaMenu) return;
      const isInsidePanel = megaPanelRef.current?.contains(event.target);
      const isInsideTrigger = megaTriggerRef.current?.contains(event.target);
      if (!isInsidePanel && !isInsideTrigger) {
        setActiveMegaMenu(null);
      }
    };

    const handleEsc = (event) => {
      if (event.key === "Escape") setActiveMegaMenu(null);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [activeMegaMenu]);

  const rootCategories = useMemo(() => {
    return categories
      .filter((category) => !getParentId(category))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [categories]);

  const childrenOf = (parentId) =>
    sortByCreatedAt(
      categories.filter((category) => getParentId(category) === parentId),
    );

  const activeMegaRoot =
    rootCategories.find((root) => root._id === activeMegaMenu) || null;

  const megaColumns = useMemo(() => {
    if (!activeMegaRoot) return [];

    const level2 = childrenOf(activeMegaRoot._id);
    const flattened = [];

    const hasLevel3 = level2.some((group) => childrenOf(group._id).length > 0);

    if (!hasLevel3) {
      level2.forEach((item) => {
        flattened.push({
          _id: item._id,
          name: item.name,
          imageUrl: item.imageUrl || "",
          isGroupTitle: false,
        });
      });
    } else {
      level2.forEach((group) => {
        flattened.push({
          _id: group._id,
          name: `${group.name}`,
          imageUrl: group.imageUrl || "",
          isGroupTitle: true,
        });

        childrenOf(group._id).forEach((item) => {
          flattened.push({
            _id: item._id,
            name: item.name,
            imageUrl: item.imageUrl || "",
            isGroupTitle: false,
          });
        });
      });
    }

    return distributeIntoColumns(flattened, 4);
  }, [activeMegaRoot, categories]);

  const startCloseTimer = () => {
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(
      () => setActiveMegaMenu(null),
      120,
    );
  };

  const clearCloseTimer = () => {
    window.clearTimeout(closeTimeoutRef.current);
  };

  const handleCategoryClick = (categoryId) => {
    setActiveMegaMenu(null);
    navigate(`/products?categoryId=${categoryId}`);
  };

  const toggleMegaMenu = (rootId) => {
    const children = childrenOf(rootId);
    if (children.length === 0) {
      handleCategoryClick(rootId);
      return;
    }
    setActiveMegaMenu((current) => (current === rootId ? null : rootId));
  };

  const openMegaMenu = (rootId) => {
    const children = childrenOf(rootId);
    if (children.length === 0) return;
    setActiveMegaMenu(rootId);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-black">
      {!isAdminView ? (
        <>
          <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
            <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-4 lg:px-8">
              <nav
                ref={megaTriggerRef}
                className="hidden items-center gap-5 justify-self-start lg:flex"
              >
                <NavLink
                  to="/"
                  className="text-[15px] font-normal text-black hover:text-red-600"
                >
                  Trang chủ
                </NavLink>

                {rootCategories.map((root) => {
                  const isActive = activeMegaMenu === root._id;
                  return (
                    <button
                      key={root._id}
                      type="button"
                      onClick={() => toggleMegaMenu(root._id)}
                      className={`border-none bg-transparent p-0 text-[15px] transition ${isActive
                        ? "font-medium text-black"
                        : "font-normal text-black hover:text-red-600"
                        }`}
                    >
                      <span className="tracking-wide">{root.name}</span>
                    </button>
                  );
                })}
                <NavLink
                  to="/collections"
                  className="text-[15px] text-black hover:text-red-600"
                >
                  Bộ sưu tập
                </NavLink>
                <NavLink
                  to="/recommendations"
                  className="text-[15px] text-black hover:text-red-600"
                >
                  Gợi ý
                </NavLink>
                <NavLink
                  to="/contact"
                  className="text-[15px] text-black hover:text-red-600"
                >
                  Liên hệ
                </NavLink>
              </nav>

              <NavLink to="/" className="justify-self-center text-4xl font-extrabold tracking-tight">
                FS
              </NavLink>

              <div className="flex items-center gap-4 justify-self-end">
                <form
                  className="hidden w-[280px] items-center border border-gray-200 px-3 py-2 lg:flex rounded-md"
                  onSubmit={(event) => {
                    event.preventDefault();
                    navigate(searchHref);
                  }}
                >
                  <Search
                    size={18}
                    strokeWidth={1.75}
                    className="shrink-0 text-gray-500"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm kiếm sản phẩm"
                    className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                </form>

                {isAuthenticated ? (
                  <div className="relative" ref={accountRef}>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-full border border-gray-200 py-1.5 pl-2 pr-3 text-sm font-medium text-black transition hover:border-black hover:bg-gray-50"
                      onClick={() => setIsAccountOpen((current) => !current)}
                    >
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-black text-xs font-bold text-white">
                        {getAvatarInitial(user, "U")}
                      </div>
                      <span className="hidden max-w-[120px] truncate lg:inline">
                        {getUserDisplayName(user, "Người dùng")}
                      </span>
                    </button>

                    {isAccountOpen ? (
                      <div className="absolute right-[-75px] mt-3 w-64 border border-gray-200 bg-white shadow-lg">
                        {isAdminUser ? (
                          <NavLink
                            to="/admin"
                            className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 text-[15px] font-normal tracking-wide text-black transition hover:bg-gray-50"
                            onClick={() => setIsAccountOpen(false)}
                          >
                            <Home className="h-5 w-5" />
                            Trang quản trị
                          </NavLink>
                        ) : null}

                        <NavLink
                          to="/profile"
                          className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 text-[15px] font-normal tracking-wide text-black transition hover:bg-gray-50"
                          onClick={() => setIsAccountOpen(false)}
                        >
                          <IdCard className="h-5 w-5" />
                          Thông tin tài khoản
                        </NavLink>

                        <NavLink
                          to="/profile?tab=orders"
                          className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 text-[15px] font-normal tracking-wide text-black transition hover:bg-gray-50"
                          onClick={() => setIsAccountOpen(false)}
                        >
                          <History className="h-5 w-5" />
                          Lịch sử đặt hàng
                        </NavLink>

                        <button
                          type="button"
                          className="flex w-full items-center gap-3 border-none bg-white px-4 py-4 text-[15px] font-normal tracking-wide text-red-500 transition hover:bg-gray-50"
                          onClick={() => {
                            setIsAccountOpen(false);
                            setIsLogoutModalOpen(true);
                          }}
                        >
                          <LogOut className="h-5 w-5" />
                          Đăng xuất
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <NavLink
                    to="/login"
                    className="flex items-center gap-2 rounded-full border border-gray-200 py-1.5 pl-2 pr-3 text-sm font-medium text-black transition hover:border-black hover:bg-gray-50"
                  >
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-gray-100 text-black">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="hidden lg:inline">Đăng nhập</span>
                  </NavLink>
                )}

                {isAuthenticated ? (
                  <NavLink
                    to="/cart"
                    className="relative grid h-10 w-10 place-items-center text-black transition hover:text-red-600"
                    aria-label={`Giỏ hàng có ${cartCount} sản phẩm`}
                  >
                    <ShoppingCart className="h-6 w-6" strokeWidth={1.9} />
                    {cartCount > 0 ? (
                      <span className="absolute -right-[3px] -top-[2px] grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white shadow-sm">
                        {cartCount > 99 ? "99+" : cartCount}
                      </span>
                    ) : null}
                  </NavLink>
                ) : null}
              </div>
            </div>
          </header>

          <div
            className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ${activeMegaMenu
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
              }`}
          />

          <section
            ref={megaPanelRef}
            className={`fixed left-0 right-0 z-50 bg-white transition-all duration-300 ${activeMegaMenu
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0 pointer-events-none"
              }`}
          >
            <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-8">
              <button
                type="button"
                className="absolute left-1/2 bottom-4 grid h-10 w-10 place-items-center rounded-full bg-black text-white"
                onClick={() => setActiveMegaMenu(null)}
                aria-label="Đóng menu"
              >
                <X size={20} />
              </button>
              <div className="mb-4 grid grid-cols-4 items-center justify-center gap-12 border-b border-gray-100 pb-6">
                {highlightItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="flex items-center gap-4 text-left"
                    onClick={() => {
                      if (item.key === "stores") navigate("/products");
                      if (item.key === "sale") navigate("/products?sale=1");
                      if (item.key === "new") navigate("/products?newArrivals=1");
                      if (item.key === "best-seller") navigate("/products?bestSeller=1");
                      setActiveMegaMenu(null);
                    }}
                  >
                    <HighlightIcon type={item.type} />
                    <span className="text-[15px] font-normal text-black">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>

              <div
                className="grid gap-12"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(Math.max(megaColumns.length, 1), 4)}, minmax(0, 1fr))`,
                }}
              >
                {megaColumns.map((col, colIndex) => (
                  <div
                    key={`col-${colIndex}`}
                    className="grid content-start gap-2"
                  >
                    {col.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => handleCategoryClick(item._id)}
                        className="group flex items-center gap-4 py-1 text-left"
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-visible bg-white">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-110"
                            />
                          ) : (
                            <Shirt
                              size={24}
                              strokeWidth={1.4}
                              className="text-zinc-700 transition-transform duration-200 group-hover:scale-110"
                            />
                          )}
                        </div>
                        <span
                          className={`line-clamp-2 text-[15px] text-black transition transition-transform duration-200 group-hover:scale-105 ${item.isGroupTitle ? "font-normal" : "font-normal"
                            }`}
                        >
                          {item.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <main className={isAdminView ? "" : ""}>
        <Outlet />
      </main>

      {!isAdminView ? (
        <footer className="mt-20 border-t border-gray-200 bg-[#101010] text-white">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-6 md:grid-cols-[1.28fr_0.8fr_0.8fr_0.8fr_1.35fr] lg:px-8 lg:py-10">
            <div>
              <NavLink to="/" className="inline-flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center bg-white text-2xl font-extrabold text-black">
                  FS
                </span>
                <span className="text-xl font-extrabold tracking-tight">
                  FashionStore
                </span>
              </NavLink>
              <p className="mt-5 max-w-sm text-sm leading-6 text-white/60">
                Thời trang nam nữ hiện đại với trải nghiệm mua sắm nhanh, gọn
                và đáng tin cậy cho từng phong cách hằng ngày.
              </p>

              <div className="mt-6 space-y-3 text-sm text-white/70">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                  <span>Thành Thới, Vĩnh Long, Việt Nam</span>
                </div>
                <a
                  href="tel:0972144904"
                  className="flex items-center gap-3 transition hover:text-white"
                >
                  <Phone className="h-4 w-4 shrink-0 text-white" />
                  <span>0972 144 904</span>
                </a>
                <a
                  href="mailto:support@fashionstore.vn"
                  className="flex items-center gap-3 transition hover:text-white"
                >
                  <Mail className="h-4 w-4 shrink-0 text-white" />
                  <span>support@fashionstore.vn</span>
                </a>
              </div>
            </div>

            <div>
              <h4 className="mb-5 text-xs font-bold uppercase text-white">
                Mua sắm
              </h4>
              <ul className="space-y-3 text-sm text-white/60">
                {footerShopLinks.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} className="transition hover:text-white">
                      {link.label}
                    </NavLink>
                  </li>
                ))}
                {rootCategories.slice(0, 3).map((category) => (
                  <li key={category._id}>
                    <NavLink
                      to={`/products?categoryId=${category._id}`}
                      className="transition hover:text-white"
                    >
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-5 text-xs font-bold uppercase text-white">
                Hỗ trợ
              </h4>
              <ul className="space-y-3 text-sm text-white/60">
                {footerSupportLinks.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} className="transition hover:text-white">
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-5 text-xs font-bold uppercase text-white">
                Chính sách
              </h4>
              <ul className="space-y-3 text-sm text-white/60">
                {footerPolicyLinks.map((label) => (
                  <li key={label}>
                    <NavLink to="/contact" className="transition hover:text-white">
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-5 text-xs font-bold uppercase text-white">
                Đăng ký nhận tin
              </h4>
              <p className="text-sm leading-6 text-white/60">
                Nhận thông tin bộ sưu tập mới, ưu đãi riêng và gợi ý phối đồ
                từ FashionStore.
              </p>
              <form
                className="mt-5 flex overflow-hidden border border-white/20 bg-white"
                onSubmit={(event) => event.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="Email của bạn"
                  className="min-w-0 flex-1 bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  className="grid w-12 place-items-center bg-black text-white transition hover:bg-red-600"
                  aria-label="Đăng ký nhận tin"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-6 flex flex-wrap gap-4">
                {[
                  { name: "COD", icon: "/images/cod.png" },
                  { name: "VNPay", icon: "/images/vnpay.png" },
                  { name: "PayPal", icon: "/images/paypal.png" }
                ].map((method) => (
                  <span
                    key={method.name}
                    className="flex items-center gap-3 border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase text-white/70 bg-white/5"
                  >
                    <img src={`${method.icon}?v=2`} alt={method.name} className="h-5 w-5 object-contain rounded-sm" />
                    {method.name}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {footerSocials.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-sm border border-white/15 px-2 py-2 text-[13px] font-medium text-white/70 transition hover:border-white hover:text-white hover:bg-white/5"
                    aria-label={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10">
            <div className="mx-auto flex max-w-[1400px] px-4 py-6 text-xs text-white/45 lg:px-8">
              <p>© 2026 FashionStore. All rights reserved.</p>
            </div>
          </div>
        </footer>
      ) : null}

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={logout}
        title="Đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất không?"
        confirmText="Đăng xuất"
      />
    </div>
  );
}
