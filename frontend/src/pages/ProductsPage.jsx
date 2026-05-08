import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, LayoutGrid, List, Plus, SlidersHorizontal, SortAsc, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts, buildCatalogFilters, filterProducts } from "../lib/catalog.js";

function getParentId(category) {
  if (!category?.parentId) return null;
  return typeof category.parentId === "string" ? category.parentId : category.parentId._id || null;
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function getCategoryIdFromProduct(product) {
  if (!product?.categoryId) return null;
  return typeof product.categoryId === "string" ? product.categoryId : product.categoryId._id || null;
}

function collectCategoryScope(categories, rootCategoryId) {
  if (!rootCategoryId) return new Set();
  const scope = new Set([rootCategoryId]);
  let changed = true;

  while (changed) {
    changed = false;
    categories.forEach((category) => {
      const categoryId = category._id;
      const parentId = getParentId(category);
      if (!scope.has(categoryId) && parentId && scope.has(parentId)) {
        scope.add(categoryId);
        changed = true;
      }
    });
  }

  return scope;
}

function findCategoryPath(categories, categoryId) {
  if (!categoryId) return [];
  const byId = new Map(categories.map((item) => [item._id, item]));
  const path = [];
  let cursor = byId.get(categoryId);

  while (cursor) {
    path.unshift(cursor);
    const parentId = getParentId(cursor);
    cursor = parentId ? byId.get(parentId) : null;
  }

  return path;
}

function getRootCategoryId(categories, categoryId) {
  const path = findCategoryPath(categories, categoryId);
  return path[0]?._id || "";
}

function colorToHex(color) {
  const map = {
    den: "#111111",
    black: "#111111",
    trang: "#F4F4F5",
    white: "#F4F4F5",
    navy: "#243447",
    xanh: "#1D4ED8",
    do: "#DC2626",
    red: "#DC2626",
    xam: "#6B7280",
    gray: "#6B7280",
    be: "#D6C6AE",
    kem: "#EFE7DA",
    nau: "#7C4A2D",
    brown: "#7C4A2D"
  };

  const key = (color || "").trim().toLowerCase();
  return map[key] || "#9CA3AF";
}

function getColorGroups(product) {
  const groups = new Map();
  const variants = product.availableVariants || [];

  variants.forEach((variant) => {
    const key = (variant.color || "Mặc định").trim();
    if (!groups.has(key)) {
      groups.set(key, {
        color: key,
        hex: colorToHex(key),
        previewImage: variant.image || product.images?.[0] || "",
        variants: []
      });
    }
    groups.get(key).variants.push(variant);
    if (!groups.get(key).previewImage && variant.image) {
      groups.get(key).previewImage = variant.image;
    }
  });

  if (groups.size === 0) {
    groups.set("Mặc định", {
      color: "Mặc định",
      hex: "#9CA3AF",
      previewImage: product.images?.[0] || "",
      variants: []
    });
  }

  return [...groups.values()];
}

function formatPrice(price) {
  return `${Number(price || 0).toLocaleString("vi-VN")} đ`;
}

const sortSequence = ["newest", "price_asc", "price_desc", "name_asc"];
const sortLabelMap = {
  newest: "Mới nhất",
  price_asc: "Giá tăng",
  price_desc: "Giá giảm",
  name_asc: "Tên A-Z"
};

export default function ProductsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagsRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [activeSwatchByProduct, setActiveSwatchByProduct] = useState({});
  const [quickAddByProduct, setQuickAddByProduct] = useState({});
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    style: "",
    gender: "",
    occasion: ""
  });

  const selectedCategoryId = searchParams.get("categoryId") || "";

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productResponse, variantResponse, categoryResponse] = await Promise.all([
          apiRequest("/products?limit=500"),
          apiRequest("/product-variants?limit=1200"),
          apiRequest("/categories?limit=1000")
        ]);

        setProducts(productResponse.data || []);
        setVariants(variantResponse.data || []);
        setCategories(categoryResponse.data || []);
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      search: searchParams.get("search") || ""
    }));
  }, [searchParams]);

  const productsWithVariants = useMemo(
    () => attachVariantsToProducts(products, variants),
    [products, variants]
  );

  const filterOptions = useMemo(
    () => buildCatalogFilters(productsWithVariants),
    [productsWithVariants]
  );

  const categoryScope = useMemo(
    () => collectCategoryScope(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const baseFilteredProducts = useMemo(() => {
    const byPanelFilters = filterProducts(productsWithVariants, filters);
    if (!selectedCategoryId) return byPanelFilters;
    return byPanelFilters.filter((product) => categoryScope.has(getCategoryIdFromProduct(product)));
  }, [productsWithVariants, filters, selectedCategoryId, categoryScope]);

  const filteredProducts = useMemo(() => {
    const data = [...baseFilteredProducts];
    if (sortBy === "price_asc") data.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === "price_desc") data.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === "name_asc") data.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
    if (sortBy === "newest") data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return data;
  }, [baseFilteredProducts, sortBy]);

  const selectedRootCategoryId = useMemo(
    () => getRootCategoryId(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const breadcrumbPath = useMemo(
    () => findCategoryPath(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const selectedNode = useMemo(
    () => categories.find((item) => item._id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const level2AnchorId = useMemo(() => {
    if (!selectedNode) return "";

    const pathLength = breadcrumbPath.length;
    if (pathLength >= 3) {
      return breadcrumbPath[1]?._id || "";
    }

    if (pathLength === 2) {
      return selectedNode._id;
    }

    return "";
  }, [selectedNode, breadcrumbPath]);

  const quickTagBaseId = useMemo(() => {
    if (level2AnchorId) return level2AnchorId;
    return selectedRootCategoryId || "";
  }, [level2AnchorId, selectedRootCategoryId]);

  const quickTagCategories = useMemo(() => {
    if (!quickTagBaseId) return [];
    return sortByCreatedAt(categories.filter((category) => getParentId(category) === quickTagBaseId));
  }, [categories, quickTagBaseId]);

  const selectedScopeForTag = selectedCategoryId || quickTagBaseId || "";

  const handleSelectQuickTag = (tagCategoryId) => {
    const next = new URLSearchParams(searchParams);
    if (tagCategoryId) next.set("categoryId", tagCategoryId);
    else next.delete("categoryId");
    setSearchParams(next);
  };

  const handleWishlist = async (product) => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      await apiRequest("/wishlists/me", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          addedFrom: "product_page"
        }
      });
      setMessage(`Đã thêm ${product.name} vào danh sách yêu thích`);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleQuickAddToggle = (productId, defaultSize) => {
    setQuickAddByProduct((current) => {
      if (current[productId]) {
        const clone = { ...current };
        delete clone[productId];
        return clone;
      }
      return { ...current, [productId]: { size: defaultSize || "" } };
    });
  };

  const handleQuickAddSize = (productId, size) => {
    setQuickAddByProduct((current) => ({ ...current, [productId]: { size } }));
  };

  const handleAddToCart = async (product, variant) => {
    if (!token) {
      navigate("/login");
      return;
    }

    if (!variant?._id) {
      setError("Sản phẩm chưa có biến thể phù hợp để thêm vào giỏ hàng.");
      return;
    }

    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: variant._id,
          quantity: 1,
          source: "product_page"
        }
      });

      setMessage(`Đã thêm ${product.name} vào giỏ hàng`);
      setQuickAddByProduct((current) => {
        const clone = { ...current };
        delete clone[product._id];
        return clone;
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleSortToggle = () => {
    const currentIndex = sortSequence.indexOf(sortBy);
    const nextValue = sortSequence[(currentIndex + 1) % sortSequence.length];
    setSortBy(nextValue);
  };

  const inputClass =
    "w-full appearance-none border border-gray-200 bg-white px-4 py-2.5 text-sm text-black transition-colors focus:border-black focus:outline-none";
  const labelClass = "mb-2 block text-[11px] font-bold uppercase tracking-widest text-black";

  return (
    <div className="bg-[#f6f6f6] pb-16 pt-6">
      <section className="mx-auto w-full max-w-[1400px] px-4 lg:px-8">
        <div className="border border-gray-300 bg-white px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[17px]">
              <span className="font-semibold text-black">{filteredProducts.length} Sản phẩm</span>
              <span className="text-gray-400">&gt;</span>
              <Link to="/" className="text-gray-600 hover:text-black">Trang chủ</Link>
              <span className="text-gray-400">&gt;</span>

              {breadcrumbPath.length ? (
                breadcrumbPath.map((item, index) => (
                  <span key={item._id} className="inline-flex items-center gap-3">
                    <span className={index === breadcrumbPath.length - 1 ? "font-semibold text-black" : "text-gray-600"}>
                      {item.name}
                    </span>
                    {index !== breadcrumbPath.length - 1 ? <span className="text-gray-400">&gt;</span> : null}
                  </span>
                ))
              ) : (
                <>
                  <span className="text-gray-600">Thời trang nam</span>
                  <span className="text-gray-400">&gt;</span>
                  <span className="font-semibold text-black">Áo</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`grid h-9 w-9 place-items-center border transition ${
                  showFilterPanel ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black"
                }`}
                onClick={() => setShowFilterPanel((current) => !current)}
                aria-label="Bộ lọc"
              >
                <SlidersHorizontal size={16} />
              </button>

              <button
                type="button"
                onClick={handleSortToggle}
                className="inline-flex h-9 items-center gap-2 border border-gray-300 bg-white px-3 text-xs font-medium text-black transition hover:border-black"
                aria-label="Sắp xếp"
              >
                <SortAsc size={14} />
                <span className="hidden sm:inline">{sortLabelMap[sortBy]}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`grid h-9 w-9 place-items-center border transition ${
                  viewMode === "grid" ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black"
                }`}
                aria-label="Chế độ lưới"
              >
                <LayoutGrid size={16} />
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`grid h-9 w-9 place-items-center border transition ${
                  viewMode === "list" ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black"
                }`}
                aria-label="Chế độ danh sách"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <div ref={tagsRef} className="scrollbar-hide flex-1 overflow-x-auto whitespace-nowrap">
              <div className="inline-flex gap-2">
                {quickTagBaseId ? (
                  <button
                    type="button"
                    onClick={() => handleSelectQuickTag(quickTagBaseId)}
                    className={`border px-5 py-3 text-[17px] font-medium transition ${
                      selectedScopeForTag === quickTagBaseId
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black hover:border-black"
                    }`}
                  >
                    Tất cả
                  </button>
                ) : null}

                {quickTagCategories.map((tag) => (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => handleSelectQuickTag(tag._id)}
                    className={`border px-5 py-3 text-[17px] font-medium transition ${
                      selectedScopeForTag === tag._id
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black hover:border-black"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gray-300 bg-white text-black hover:border-black"
              onClick={() => tagsRef.current?.scrollBy({ left: 260, behavior: "smooth" })}
              aria-label="Cuộn danh mục"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {showFilterPanel ? (
          <div className="mt-4 grid gap-4 border border-gray-200 bg-white p-4 md:grid-cols-4">
            <label>
              <span className={labelClass}>Tìm kiếm</span>
              <input
                className={inputClass}
                placeholder="Tìm kiếm sản phẩm..."
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </label>

            <label>
              <span className={labelClass}>Phong cách</span>
              <select
                className={inputClass}
                value={filters.style}
                onChange={(event) => setFilters((current) => ({ ...current, style: event.target.value }))}
              >
                <option value="">Tất cả</option>
                {filterOptions.styles.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>Giới tính</span>
              <select
                className={inputClass}
                value={filters.gender}
                onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))}
              >
                <option value="">Tất cả</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="unisex">Unisex</option>
              </select>
            </label>

            <label>
              <span className={labelClass}>Dịp sử dụng</span>
              <select
                className={inputClass}
                value={filters.occasion}
                onChange={(event) => setFilters((current) => ({ ...current, occasion: event.target.value }))}
              >
                <option value="">Tất cả</option>
                {filterOptions.occasions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <div className="md:col-span-4">
              <button
                type="button"
                className="border border-black px-5 py-2 text-xs font-bold uppercase tracking-widest transition hover:bg-black hover:text-white"
                onClick={() => setFilters({ search: "", style: "", gender: "", occasion: "" })}
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="mt-4 border-l-4 border-black bg-gray-100 px-4 py-3 text-sm text-black">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-5">
          {filteredProducts.length === 0 ? (
            <div className="border border-gray-200 bg-white py-24 text-center">
              <h3 className="mb-2 text-lg font-semibold text-black">Không tìm thấy sản phẩm</h3>
              <p className="text-sm text-gray-500">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
            </div>
          ) : (
            <div
              className={
                viewMode === "list"
                  ? "grid grid-cols-1 gap-4"
                  : "grid grid-cols-2 gap-[1px] bg-gray-200 md:grid-cols-3 xl:grid-cols-4"
              }
            >
              {filteredProducts.map((product) => {
                const colorGroups = getColorGroups(product);
                const activeColorName = activeSwatchByProduct[product._id] || colorGroups[0]?.color;
                const activeColorGroup =
                  colorGroups.find((group) => group.color === activeColorName) || colorGroups[0];
                const primaryImage =
                  activeColorGroup?.previewImage || product.images?.[0] || "https://placehold.co/900x1200/F5F5F5/222?text=Fashion";
                const secondaryImage =
                  product.images?.[1] ||
                  activeColorGroup?.variants?.find((item) => item.image && item.image !== primaryImage)?.image ||
                  primaryImage;

                const sizes = [...new Set((activeColorGroup?.variants || []).map((item) => item.size).filter(Boolean))];
                const quickAdd = quickAddByProduct[product._id];
                const selectedSize = quickAdd?.size || sizes[0] || "";
                const selectedVariant =
                  (activeColorGroup?.variants || []).find((item) => item.size === selectedSize) ||
                  activeColorGroup?.variants?.[0] ||
                  null;

                return (
                  <article
                    key={product._id}
                    className={`group bg-white ${viewMode === "list" ? "grid grid-cols-[220px_1fr] gap-4 border border-gray-200 p-3" : ""}`}
                  >
                    <div className="relative overflow-hidden bg-gray-100">
                      <Link to={`/products/${product._id}?color=${encodeURIComponent(activeColorName)}`} className="absolute inset-0 block">
                        <img
                          src={primaryImage}
                          alt={product.name}
                          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                        />
                        <img
                          src={secondaryImage}
                          alt={product.name}
                          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        />
                      </Link>

                      <div className={`${viewMode === "list" ? "aspect-[4/5]" : "aspect-[4/5]"}`} />

                      <div
                        className="absolute inset-x-0 bottom-0 h-[52px] border-t border-gray-200 bg-white/95 px-3 py-1"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, rgba(219,231,245,0.55) 0px, rgba(219,231,245,0.55) 2px, rgba(255,255,255,0.9) 2px, rgba(255,255,255,0.9) 4px)"
                        }}
                      >
                        <div className="flex h-full items-center justify-between gap-3">
                          <p className="text-[32px] md:text-[31px] lg:text-[30px]">{""}</p>
                          <p className="max-w-[70%] text-[31px]">{""}</p>
                          <p className="text-[11px] font-semibold leading-4 text-red-600">
                            {product.tags?.[0] || "Simplicity"}
                            <br />
                            &amp; Comfort
                          </p>
                          <button
                            type="button"
                            onClick={() => handleQuickAddToggle(product._id, sizes[0])}
                            className="grid h-8 w-8 place-items-center rounded-full border border-gray-300 bg-white text-black transition hover:border-black"
                            aria-label="Thêm nhanh vào giỏ"
                          >
                            {quickAdd ? <X size={14} /> : <Plus size={16} />}
                          </button>
                        </div>
                      </div>

                      {quickAdd ? (
                        <div className="absolute bottom-14 right-2 z-10 w-44 border border-gray-200 bg-white p-3 shadow-xl">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Chọn size</p>
                          <div className="mb-3 flex flex-wrap gap-2">
                            {(sizes.length ? sizes : ["M"]).map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => handleQuickAddSize(product._id, size)}
                                className={`h-8 w-8 border text-xs font-medium transition ${
                                  selectedSize === size
                                    ? "border-black bg-black text-white"
                                    : "border-gray-300 bg-white text-black hover:border-black"
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(product, selectedVariant)}
                            className="w-full bg-black py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800"
                          >
                            Thêm giỏ hàng
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className={`${viewMode === "list" ? "pt-2" : "px-3 py-3"} bg-white`}>
                      <h3 className="line-clamp-1 text-sm text-black">
                        <Link to={`/products/${product._id}?color=${encodeURIComponent(activeColorName)}`} className="hover:text-red-600">
                          {product.name}
                        </Link>
                      </h3>

                      <div className="mt-2 flex items-center gap-2">
                        {colorGroups.slice(0, 6).map((group) => (
                          <button
                            key={`${product._id}-${group.color}`}
                            type="button"
                            title={group.color}
                            onMouseEnter={() =>
                              setActiveSwatchByProduct((current) => ({ ...current, [product._id]: group.color }))
                            }
                            onClick={() =>
                              setActiveSwatchByProduct((current) => ({ ...current, [product._id]: group.color }))
                            }
                            className={`relative overflow-hidden w-8 h-10 border transition-all p-0 m-0 bg-white ${
                              activeColorName === group.color
                                ? "border-black"
                                : "border-gray-200 opacity-70 hover:opacity-100"
                            }`}
                          >
                            {group.previewImage ? (
                              <img src={group.previewImage} alt={group.color} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] font-bold uppercase tracking-widest text-center flex items-center justify-center h-full w-full leading-tight px-0.5">{group.color}</span>
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-[18px] font-semibold text-black">{formatPrice(product.price)}</p>
                        <button
                          type="button"
                          onClick={() => handleWishlist(product)}
                          className="text-xs font-medium text-gray-500 transition hover:text-red-600"
                        >
                          Yêu thích
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
