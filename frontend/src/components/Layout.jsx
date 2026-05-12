import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  History,
  IdCard,
  Image as ImageIcon,
  LogOut,
  Search,
  Shirt,
  Store,
  User,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";

function getParentId(category) {
  if (!category?.parentId) return null;
  return typeof category.parentId === "string" ? category.parentId : category.parentId._id || null;
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function chunkArray(items, columns = 4) {
  const result = Array.from({ length: columns }, () => []);
  const maxPerColumn = 4;
  items.forEach((item, index) => {
    const colIndex = Math.min(Math.floor(index / maxPerColumn), columns - 1);
    result[colIndex].push(item);
  });
  return result;
}

const highlightItems = [
  { key: "new", label: "Hàng Mới", type: "new" },
  { key: "easy-buy", label: "Easy Buy", type: "star" },
  { key: "sale", label: "Ưu đãi", type: "sale" },
  { key: "best-seller", label: "Bán Chạy", type: "hot" }
];

function HighlightIcon({ type }) {
  if (type === "new") {
    return (
      <div className="grid h-10 w-10 place-items-center bg-green-700 text-[11px] font-bold uppercase text-white">
        NEW
      </div>
    );
  }

  if (type === "sale") {
    return (
      <div className="grid h-10 w-10 place-items-center bg-red-600 text-[11px] font-bold uppercase text-white">
        SALE
      </div>
    );
  }

  if (type === "star") {
    return (
      <div className="grid h-10 w-10 place-items-center text-3xl leading-none text-amber-500">
        ★
      </div>
    );
  }

  if (type === "hot") {
    return (
      <div className="grid h-10 w-10 place-items-center bg-orange-500 text-[11px] font-bold uppercase text-white">
        HOT
      </div>
    );
  }

  return (
    <div className="grid h-10 w-10 place-items-center text-blue-600">
      <Store size={26} strokeWidth={1.8} />
    </div>
  );
}

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
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

  const isAdminView = location.pathname.startsWith("/admin");
  const isAdminUser = user?.role === "admin";

  const searchHref = useMemo(
    () => `/products${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`,
    [search]
  );

  useEffect(() => {
    setActiveMegaMenu(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    apiRequest("/categories?limit=1000")
      .then((response) => setCategories(response.data || []))
      .catch(() => {});
  }, []);

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

  const rootCategories = useMemo(
    () => sortByCreatedAt(categories.filter((category) => !getParentId(category))),
    [categories]
  );

  const childrenOf = (parentId) =>
    sortByCreatedAt(categories.filter((category) => getParentId(category) === parentId));

  const activeMegaRoot = rootCategories.find((root) => root._id === activeMegaMenu) || null;

  const megaColumns = useMemo(() => {
    if (!activeMegaRoot) return [[], [], [], []];

    const level2 = childrenOf(activeMegaRoot._id);
    const flattened = [];

    const hasLevel3 = level2.some((group) => childrenOf(group._id).length > 0);

    if (!hasLevel3) {
      level2.forEach((item) => {
        flattened.push({
          _id: item._id,
          name: item.name,
          imageUrl: item.imageUrl || "",
          isGroupTitle: false
        });
      });
    } else {
      level2.forEach((group) => {
        flattened.push({
          _id: group._id,
          name: `${group.name}`,
          imageUrl: group.imageUrl || "",
          isGroupTitle: true
        });

        childrenOf(group._id).forEach((item) => {
          flattened.push({
            _id: item._id,
            name: item.name,
            imageUrl: item.imageUrl || "",
            isGroupTitle: false
          });
        });
      });
    }

    return chunkArray(flattened, 4);
  }, [activeMegaRoot, categories]);

  const startCloseTimer = () => {
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => setActiveMegaMenu(null), 120);
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
            <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 lg:px-8">
              <nav
                ref={megaTriggerRef}
                className="hidden items-center gap-5 lg:flex"
                onMouseLeave={startCloseTimer}
                onMouseEnter={clearCloseTimer}
              >
                <NavLink to="/" className="text-[15px] font-normal text-black hover:text-red-600">
                  Trang chủ
                </NavLink>

                {rootCategories.map((root) => {
                  const isActive = activeMegaMenu === root._id;
                  return (
                    <button
                      key={root._id}
                      type="button"
                      onMouseEnter={() => {
                        clearCloseTimer();
                        openMegaMenu(root._id);
                      }}
                      onClick={() => toggleMegaMenu(root._id)}
                      className={`border-none bg-transparent p-0 text-[15px] transition ${
                        isActive ? "font-medium text-black" : "font-normal text-black hover:text-red-600"
                      }`}
                    >
                      <span className="tracking-wide">{root.name}</span>
                    </button>
                  );
                })}
                <NavLink to="/products" className="text-[15px] text-black hover:text-red-600">
                  Về FashionStore
                </NavLink>
                <NavLink to="/collections" className="text-[15px] text-black hover:text-red-600">
                  Bộ sưu tập
                </NavLink>
                <NavLink to="/products?tag=uu-dai" className="text-[15px] text-red-600 hover:opacity-80">
                  Ưu đãi
                </NavLink>
              </nav>

              <NavLink to="/" className="text-4xl font-bold tracking-tight">
                FS
              </NavLink>

              <div className="flex items-center gap-4">
                <form
                  className="hidden w-[320px] items-center border border-gray-200 px-3 py-2 lg:flex"
                  onSubmit={(event) => {
                    event.preventDefault();
                    navigate(searchHref);
                  }}
                >
                  <Search size={18} strokeWidth={1.75} className="shrink-0 text-gray-500" />
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
                      className="flex items-center gap-2 border-none bg-transparent text-sm text-black transition hover:text-red-600"
                      onClick={() => setIsAccountOpen((current) => !current)}
                    >
                      <User className="h-5 w-5" />
                      <span className="hidden max-w-[140px] truncate lg:inline">
                        {user?.full_name || user?.username || "Người dùng"}
                      </span>
                    </button>

                    {isAccountOpen ? (
                      <div className="absolute right-[-75px] mt-3 w-64 border border-gray-200 bg-white shadow-lg">
                        {isAdminUser ? (
                          <NavLink
                            to="/admin"
                            className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 text-sm font-normal tracking-widest text-black transition hover:bg-gray-50"
                            onClick={() => setIsAccountOpen(false)}
                          >
                            <Home className="h-5 w-5" />
                            Trang quản trị
                          </NavLink>
                        ) : null}

                        <NavLink
                          to="/profile"
                          className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 text-sm font-normal tracking-widest text-black transition hover:bg-gray-50"
                          onClick={() => setIsAccountOpen(false)}
                        >
                          <IdCard className="h-5 w-5" />
                          Thông tin tài khoản
                        </NavLink>

                        <NavLink
                          to="/orders"
                          className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 text-sm font-normal tracking-widest text-black transition hover:bg-gray-50"
                          onClick={() => setIsAccountOpen(false)}
                        >
                          <History className="h-5 w-5" />
                          Lịch sử đặt hàng
                        </NavLink>

                        <button
                          type="button"
                          className="flex w-full items-center gap-3 border-none bg-white px-4 py-4 text-sm font-normal tracking-widest text-red-500 transition hover:bg-gray-50"
                          onClick={() => {
                            setIsAccountOpen(false);
                            logout();
                          }}
                        >
                          <LogOut className="h-5 w-5" />
                          Đăng xuất
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <NavLink to="/login" className="flex items-center gap-2 text-sm text-black hover:text-red-600">
                    <User className="h-5 w-5" />
                    <span className="hidden lg:inline">Đăng nhập</span>
                  </NavLink>
                )}

                {isAuthenticated ? (
                  <NavLink to="/cart" className="text-black transition hover:text-red-600" aria-label="Giỏ hàng">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                  </NavLink>
                ) : null}

              </div>
            </div>
          </header>

          <div
            className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ${
              activeMegaMenu ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
          />

          <section
            ref={megaPanelRef}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={startCloseTimer}
            className={`fixed left-0 right-0 top-16 z-50 bg-white transition-all duration-300 ${
              activeMegaMenu ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none"
            }`}
          >
            <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-8">
              <div className="mb-4 grid grid-cols-4 gap-12 border-b border-gray-100 pb-6">
                {highlightItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="flex items-center gap-4 text-left"
                    onClick={() => {
                      if (item.key === "stores") navigate("/products");
                      if (item.key === "sale") navigate("/products?tag=uu-dai");
                      if (item.key === "new") navigate("/products?sort=newest");
                      if (item.key === "easy-buy") navigate("/products?tag=easy-buy");
                      if (item.key === "best-seller") navigate("/products?tag=ban-chay");
                      setActiveMegaMenu(null);
                    }}
                  >
                    <HighlightIcon type={item.type} />
                    <span className="text-[15px] font-normal text-black">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-12">
                {megaColumns.map((col, colIndex) => (
                  <div key={`col-${colIndex}`} className="grid content-start gap-2">
                    {col.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => handleCategoryClick(item._id)}
                        className="group flex items-center gap-4 py-1 text-left"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden bg-white">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
                          ) : (
                            <Shirt size={24} strokeWidth={1.4} className="text-zinc-700" />
                          )}
                        </div>
                        <span
                          className={`line-clamp-2 text-[15px] text-black transition group-hover:text-red-600 ${
                            item.isGroupTitle ? "font-medium" : "font-normal"
                          }`}
                        >
                          {item.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-gray-100 pt-6">
                <form
                  className="mx-auto flex w-full items-center border border-gray-200 px-4 py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setActiveMegaMenu(null);
                    navigate(searchHref);
                  }}
                >
                  <Search className="h-5 w-5 shrink-0 text-gray-500" />
                  <input
                    className="mx-3 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                    placeholder="Tìm kiếm"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button type="button" className="text-gray-500">
                    <ImageIcon className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </div>

            <button
              type="button"
              className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-black text-white"
              onClick={() => setActiveMegaMenu(null)}
              aria-label="Đóng menu"
            >
              <X size={20} />
            </button>
          </section>
        </>
      ) : null}

      <main className={isAdminView ? "" : "mx-auto w-full max-w-[1400px] p-4 lg:p-8"}>
        <Outlet />
      </main>

      {!isAdminView ? (
        <footer className="mt-16 border-t border-gray-100 bg-white py-12">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 md:grid-cols-4 lg:px-8">
            <div>
              <h3 className="mb-4 text-lg font-extrabold uppercase tracking-[0.1em]">FashionStore</h3>
              <p className="mb-4 text-sm leading-relaxed text-gray-500">
                Thương hiệu thời trang nam nữ mang phong cách tối giản, hiện đại và trẻ trung.
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-widest">Về chúng tôi</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <a href="#" className="hover:text-black">Câu chuyện thương hiệu</a>
                </li>
                <li>
                  <a href="#" className="hover:text-black">Tuyển dụng</a>
                </li>
                <li>
                  <a href="#" className="hover:text-black">Liên hệ</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-widest">Chính sách</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <a href="#" className="hover:text-black">Chính sách đổi trả</a>
                </li>
                <li>
                  <a href="#" className="hover:text-black">Chính sách bảo mật</a>
                </li>
                <li>
                  <a href="#" className="hover:text-black">Hướng dẫn mua hàng</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-widest">Đăng ký nhận tin</h4>
              <div className="flex border-b border-black pb-2">
                <input type="email" placeholder="Nhập email của bạn" className="w-full bg-transparent text-sm outline-none" />
                <button className="text-xs font-bold uppercase hover:text-gray-500">Gửi</button>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-12 flex max-w-[1400px] flex-col items-center justify-between border-t border-gray-100 px-4 pt-8 text-xs text-gray-400 md:flex-row lg:px-8">
            <p>© 2026 FashionStore. All rights reserved.</p>
            <div className="mt-4 flex gap-4 md:mt-0">
              <a href="#" className="hover:text-black">Facebook</a>
              <a href="#" className="hover:text-black">Instagram</a>
              <a href="#" className="hover:text-black">Tiktok</a>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
