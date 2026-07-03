import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Send,
  ShieldCheck,
  ShoppingCart,
  Shirt,
  Truck,
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
    title: "Đổi trả 07 ngày",
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

function CustomUserIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" className={className} fill="currentColor">
      <path d="M14.5156 12.875C15.9479 12.875 17.1719 13.3958 18.1875 14.4375C19.2292 15.4531 19.75 16.6771 19.75 18.1094V19.125C19.75 19.6458 19.5677 20.0885 19.2031 20.4531C18.8385 20.8177 18.3958 21 17.875 21H4.125C3.60417 21 3.16146 20.8177 2.79688 20.4531C2.43229 20.0885 2.25 19.6458 2.25 19.125V18.1094C2.25 16.6771 2.75781 15.4531 3.77344 14.4375C4.8151 13.3958 6.05208 12.875 7.48438 12.875C7.82292 12.875 8.31771 12.9792 8.96875 13.1875C9.64583 13.3958 10.3229 13.5 11 13.5C11.6771 13.5 12.3542 13.3958 13.0312 13.1875C13.7083 12.9792 14.2031 12.875 14.5156 12.875ZM17.875 19.125V18.1094C17.875 17.1979 17.5365 16.4167 16.8594 15.7656C16.2083 15.0885 15.4271 14.75 14.5156 14.75C14.4375 14.75 14.0208 14.8542 13.2656 15.0625C12.5365 15.2708 11.7812 15.375 11 15.375C10.2188 15.375 9.45052 15.2708 8.69531 15.0625C7.96615 14.8542 7.5625 14.75 7.48438 14.75C6.57292 14.75 5.77865 15.0885 5.10156 15.7656C4.45052 16.4167 4.125 17.1979 4.125 18.1094V19.125H17.875ZM14.9844 10.6094C13.8906 11.7031 12.5625 12.25 11 12.25C9.4375 12.25 8.10938 11.7031 7.01562 10.6094C5.92188 9.51562 5.375 8.1875 5.375 6.625C5.375 5.0625 5.92188 3.73438 7.01562 2.64062C8.10938 1.54688 9.4375 1 11 1C12.5625 1 13.8906 1.54688 14.9844 2.64062C16.0781 3.73438 16.625 5.0625 16.625 6.625C16.625 8.1875 16.0781 9.51562 14.9844 10.6094ZM13.6562 3.96875C12.9271 3.23958 12.0417 2.875 11 2.875C9.95833 2.875 9.07292 3.23958 8.34375 3.96875C7.61458 4.69792 7.25 5.58333 7.25 6.625C7.25 7.66667 7.61458 8.55208 8.34375 9.28125C9.07292 10.0104 9.95833 10.375 11 10.375C12.0417 10.375 12.9271 10.0104 13.6562 9.28125C14.3854 8.55208 14.75 7.66667 14.75 6.625C14.75 5.58333 14.3854 4.69792 13.6562 3.96875Z"></path>
    </svg>
  );
}

function CustomSearchIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" className={className} fill="currentColor">
      <path d="M20.8438 19.3203C21.0781 19.5286 21.0781 19.75 20.8438 19.9844L19.9844 20.8438C19.75 21.0781 19.5286 21.0781 19.3203 20.8438L14.5938 16.1172C14.4896 16.013 14.4375 15.9089 14.4375 15.8047V15.2578C12.901 16.5859 11.1302 17.25 9.125 17.25C6.88542 17.25 4.97135 16.4557 3.38281 14.8672C1.79427 13.2786 1 11.3646 1 9.125C1 6.88542 1.79427 4.97135 3.38281 3.38281C4.97135 1.79427 6.88542 1 9.125 1C11.3646 1 13.2786 1.79427 14.8672 3.38281C16.4557 4.97135 17.25 6.88542 17.25 9.125C17.25 11.1302 16.5859 12.901 15.2578 14.4375H15.8047C15.9349 14.4375 16.0391 14.4896 16.1172 14.5938L20.8438 19.3203ZM4.71094 13.5391C5.9349 14.763 7.40625 15.375 9.125 15.375C10.8438 15.375 12.3151 14.763 13.5391 13.5391C14.763 12.3151 15.375 10.8438 15.375 9.125C15.375 7.40625 14.763 5.9349 13.5391 4.71094C12.3151 3.48698 10.8438 2.875 9.125 2.875C7.40625 2.875 5.9349 3.48698 4.71094 4.71094C3.48698 5.9349 2.875 7.40625 2.875 9.125C2.875 10.8438 3.48698 12.3151 4.71094 13.5391Z"></path>
    </svg>
  );
}

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

function formatSearchPrice(price) {
  return `${Number(price || 0).toLocaleString("vi-VN")} đ`;
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
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const isAdminView = location.pathname.startsWith("/admin");
  const isAdminUser = user?.role === "admin";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  useEffect(() => {
    setActiveMegaMenu(null);
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateHeader = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 50) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsHeaderVisible(true);
      }

      lastScrollY = currentScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await apiRequest(
          `/products/search?q=${encodeURIComponent(trimmed)}&limit=10`
        );
        setSearchResults(response.data || []);
        setHasSearched(true);
      } catch {
        setSearchResults([]);
        setHasSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Close search on click outside
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen]);

  const openSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    closeSearch();
    navigate(`/products?search=${encodeURIComponent(trimmed)}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Escape") closeSearch();
  };

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
          <header className={`sticky top-0 z-50 border-b border-gray-200 bg-white transition-transform duration-300 ${isHeaderVisible || activeMegaMenu || isSearchOpen ? "translate-y-0" : "-translate-y-full"}`}>
            <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-6 lg:px-6">
              <nav
                ref={megaTriggerRef}
                className="hidden items-center gap-5 justify-self-start lg:flex"
              >
                <NavLink
                  to="/"
                  className="text-[17px] font-semibold text-black hover:text-red-600"
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
                      className={`border-none bg-transparent p-0 text-[17px] transition font-semibold text-black ${isActive
                        ? "underline underline-offset-8 decoration-3 decoration-black"
                        : "hover:text-red-600"
                        }`}
                    >
                      <span className="tracking-wide">{root.name}</span>
                    </button>
                  );
                })}
                <NavLink
                  to="/collections"
                  className="text-[17px] font-semibold text-black hover:text-red-600"
                >
                  Bộ sưu tập
                </NavLink>
                <NavLink
                  to="/recommendations"
                  className="text-[17px] font-semibold text-black hover:text-red-600"
                >
                  Gợi ý
                </NavLink>
                <NavLink
                  to="/contact"
                  className="text-[17px] font-semibold text-black hover:text-red-600"
                >
                  Liên hệ
                </NavLink>
              </nav>

              <NavLink to="/" className="font-serif text-4xl font-black tracking-tighter justify-self-center">
                FS
              </NavLink>

              <div className="flex items-center gap-3 justify-self-end">
                <button
                  type="button"
                  onClick={openSearch}
                  className="grid h-10 w-10 place-items-center text-black transition hover:text-red-600"
                  aria-label="Tìm kiếm"
                >
                  <CustomSearchIcon className="h-6 w-6" />
                </button>
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
                    className="grid h-10 w-10 place-items-center text-black transition hover:text-red-600"
                    aria-label="Đăng nhập"
                  >
                    <CustomUserIcon className="h-6 w-6" />
                  </NavLink>
                )}

                <NavLink
                  to="/cart"
                  className="relative grid h-10 w-10 place-items-center text-black transition hover:text-red-600"
                  aria-label={`Giỏ hàng có ${cartCount} sản phẩm`}
                >
                  <ShoppingCart className="h-6 w-6" strokeWidth={1.9} />
                  <span className="absolute -right-[3px] -top-[2px] grid min-h-5 min-w-5 place-items-center rounded-full bg-[#ff0000] px-1 text-[11px] font-semibold text-white shadow-sm">
                    {cartCount > 99 ? "99+" : (cartCount || 0)}
                  </span>
                </NavLink>
              </div>
            </div>
          </header>

          {/* Search overlay */}
          <div
            className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${isSearchOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
              }`}
            onClick={closeSearch}
          />
          <div
            ref={searchContainerRef}
            className={`fixed left-0 right-0 top-0 z-[70] bg-white shadow-xl transition-all duration-300 ${isSearchOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none"
              }`}
          >
            <div className="mx-auto flex max-h-screen w-full max-w-[1400px] flex-col px-4 lg:px-8">
              <div className="flex shrink-0 items-center justify-between gap-6 py-4 lg:gap-10">
                {/* Logo */}
                <Link
                  to="/"
                  className="hidden shrink-0 font-serif text-3xl font-black tracking-tighter text-black lg:flex lg:text-4xl"
                  onClick={closeSearch}
                >
                  <span className="flex items-center">
                    FS
                  </span>
                </Link>

                {/* Search Form */}
                <form onSubmit={handleSearchSubmit} className="relative flex h-11 w-full max-w-4xl border border-black flex-1 items-center bg-[#f5f6f8] px-4">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Tìm kiếm sản phẩm..."
                    className="h-full w-full border-none bg-transparent pr-12 text-[15px] font-normal text-black placeholder-gray-500 outline-none"
                    autoComplete="off"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                      className="absolute right-12 grid h-full w-8 place-items-center text-gray-400 transition hover:text-black"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="absolute right-3 grid h-full w-8 place-items-center text-gray-500 transition hover:text-black"
                    aria-label="Tìm kiếm"
                  >
                    <CustomSearchIcon className="h-5 w-5" />
                  </button>
                </form>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={closeSearch}
                  className="grid h-10 w-10 shrink-0 place-items-center text-gray-500 transition hover:text-black"
                  aria-label="Đóng tìm kiếm"
                >
                  <X className="h-[28px] w-[28px]" strokeWidth={1.5} />
                </button>
              </div>

              {/* Search results dropdown */}
              {searchQuery.trim() && (
                <div className="flex-1 overflow-y-auto pb-6 pt-2">
                  <div className="flex w-full justify-between gap-6 lg:gap-10">
                    {/* Invisible Spacer for Logo */}
                    <div className="hidden shrink-0 font-serif text-3xl font-black tracking-tighter lg:flex lg:text-4xl invisible" aria-hidden="true">
                      <span className="flex items-center">FS</span>
                    </div>

                    {/* Results Container */}
                    <div className="w-full max-w-4xl flex-1 border-t border-gray-100 pt-2">
                      {isSearching ? (
                        <div className="space-y-3 py-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex animate-pulse items-center gap-4">
                              <div className="h-16 w-16 rounded bg-gray-200" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-3/4 rounded bg-gray-200" />
                                <div className="h-3 w-1/3 rounded bg-gray-200" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : hasSearched && searchResults.length === 0 ? (
                        <div className="py-8 text-center">
                          <p className="text-gray-500">
                            Không tìm thấy sản phẩm nào cho &ldquo;
                            <span className="font-medium text-black">{searchQuery.trim()}</span>
                            &rdquo;
                          </p>
                          <p className="mt-1 text-sm text-gray-400">
                            Hãy thử tìm kiếm với từ khóa khác
                          </p>
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div>
                          <div className="divide-y divide-gray-50">
                            {searchResults.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="flex w-full items-center gap-4 px-1 py-3 text-left transition hover:bg-gray-50"
                                onClick={() => {
                                  closeSearch();
                                  navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
                                }}
                              >
                                <img
                                  src={item.imageUrl || "/placeholder-product.png"}
                                  alt={item.name}
                                  className="h-16 w-16 rounded border border-gray-100 object-cover"
                                  onError={(e) => { e.target.onerror = null; e.target.src = "/placeholder-product.png"; }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-black">
                                    {item.name}
                                  </p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-sm font-semibold text-red-600">
                                      {formatSearchPrice(item.currentPrice)}
                                    </span>
                                    {item.discount > 0 && (
                                      <span className="text-xs text-gray-400 line-through">
                                        {formatSearchPrice(item.originalPrice)}
                                      </span>
                                    )}
                                    {item.discount > 0 && (
                                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
                                        -{item.discount}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleSearchSubmit}
                            className="mt-3 w-full border border-black py-2.5 text-center text-sm font-semibold text-white bg-black transition hover:bg-white hover:text-black"
                          >
                            Xem tất cả kết quả ({searchResults.length > 9 ? "10+" : searchResults.length})
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* Invisible Spacer for Close Button */}
                    <div className="grid h-10 w-10 shrink-0 invisible" aria-hidden="true">
                      <X className="h-[28px] w-[28px]" strokeWidth={1.5} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

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
        <footer className="mt-10 border-t border-gray-200 bg-[#101010] text-white">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-6 md:grid-cols-[1.28fr_0.8fr_0.8fr_0.8fr_1.35fr] lg:px-8 lg:py-10">
            <div>
              <NavLink to="/" className="inline-flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center font-serif bg-white text-2xl font-black text-black">
                  FS
                </span>
                <span className="text-xl font-extrabold tracking-tight">
                  FashionStore
                </span>
              </NavLink>
              <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
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
