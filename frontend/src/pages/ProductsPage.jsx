import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Heart,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
  SortAsc,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import {
  attachVariantsToProducts,
  buildCatalogFilters,
  filterProducts,
} from "../lib/catalog.js";
import { getProductPath } from "../lib/slug.js";
import { sortSizes } from "../lib/sizes.js";
import { trackBehavior } from "../lib/tracking.js";
import { formatProductName } from "../lib/productName.js";

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

function getCategoryIdFromProduct(product) {
  if (!product?.categoryId) return null;
  return typeof product.categoryId === "string"
    ? product.categoryId
    : product.categoryId._id || null;
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
    brown: "#7C4A2D",
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
        previewImage: variant.image || "",
        variants: [],
      });
    }
    groups.get(key).variants.push(variant);
    if (!groups.get(key).previewImage && variant.image) {
      groups.get(key).previewImage = variant.image;
    }
  });

  groups.forEach((group) => {
    if (!group.previewImage) {
      group.previewImage = product.images?.[0] || "";
    }
  });

  if (groups.size === 0) {
    groups.set("Mặc định", {
      color: "Mặc định",
      hex: "#9CA3AF",
      previewImage: product.images?.[0] || "",
      variants: [],
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
  name_asc: "Tên A-Z",
};

const PAGE_SIZE = 12;

export default function ProductsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagsRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showMobileCategoryPanel, setShowMobileCategoryPanel] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");
  const [activeSwatchByProduct, setActiveSwatchByProduct] = useState({});
  const [quickAddByProduct, setQuickAddByProduct] = useState({});
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    style: "",
    gender: searchParams.get("gender") || "",
    occasion: "",
    soldOnly: searchParams.get("bestSeller") === "1",
  });

  const selectedCategoryId = searchParams.get("categoryId") || "";
  const isBestSellerContext = searchParams.get("bestSeller") === "1";
  const isNewArrivalsContext = searchParams.get("newArrivals") === "1";
  const isCategoryContext = Boolean(selectedCategoryId);
  const useNewAllProductsLayout = !isCategoryContext;

  // Map productId -> collection name
  const productCollectionMap = useMemo(() => {
    const map = new Map();
    collections.forEach((col) => {
      if (!col.isActive) return;
      (col.products || []).forEach((p) => {
        const pid = p._id || p;
        if (!map.has(pid)) map.set(pid, col.name);
      });
    });
    return map;
  }, [collections]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const requests = [
          apiRequest("/products?limit=500"),
          apiRequest("/product-variants?limit=1200"),
          apiRequest("/categories?limit=1000"),
          apiRequest("/collections?limit=100&isActive=true"),
        ];
        if (token) requests.push(apiRequest("/wishlists/me", { token }));

        const [
          productResponse,
          variantResponse,
          categoryResponse,
          collectionResponse,
          wishlistResponse,
        ] = await Promise.all(requests);

        setProducts(productResponse.data || []);
        setVariants(variantResponse.data || []);
        setCategories(categoryResponse.data || []);
        setCollections(collectionResponse.data || []);
        setWishlistProductIds(
          new Set(
            (wishlistResponse?.data?.items || [])
              .map((item) => item.productId?._id)
              .filter(Boolean),
          ),
        );
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    loadData();
  }, [token]);

  const toggleWishlist = async (product) => {
    if (!token) {
      navigate("/login");
      return;
    }

    const isWishlisted = wishlistProductIds.has(product._id);

    try {
      if (isWishlisted) {
        await apiRequest(`/wishlists/me/product/${product._id}`, {
          method: "DELETE",
          token,
        });
        setWishlistProductIds((current) => {
          const next = new Set(current);
          next.delete(product._id);
          return next;
        });
        setMessage(`Đã bỏ ${formatProductName(product.name)} khỏi danh sách yêu thích`);
        
        // Track remove_from_wishlist behavior
        trackBehavior(token, {
          actionType: "remove_from_wishlist",
          productId: product._id,
          source: "category"
        });
      } else {
        await apiRequest("/wishlists/me", {
          method: "POST",
          token,
          body: {
            productId: product._id,
            addedFrom: "product_page",
          },
        });
        setWishlistProductIds((current) => new Set([...current, product._id]));
        setMessage(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);
        
        // Track favorite behavior
        const styleToTrack = Array.isArray(product.style) ? product.style[0] : product.style;
        trackBehavior(token, {
          actionType: "favorite",
          productId: product._id,
          source: "category",
          metadata: {
            categoryId: typeof product.categoryId === "object" ? product.categoryId?._id : product.categoryId,
            style: styleToTrack || ""
          }
        });
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      search: searchParams.get("search") || "",
      gender: searchParams.get("gender") || "",
      soldOnly: searchParams.get("bestSeller") === "1",
    }));

    if (searchParams.get("newArrivals") === "1") {
      setSortBy("newest");
    }
  }, [searchParams]);

  // Track search behavior with debounce
  useEffect(() => {
    if (!token) return;

    // Only track if at least one filter is active
    const hasSearch = filters.search.trim().length > 0;
    const hasFilters = filters.style || filters.gender || filters.occasion || selectedCategoryId;
    
    if (!hasSearch && !hasFilters) return;

    const timer = setTimeout(() => {
      // Build a descriptive keyword for DB logging if user is just filtering
      let keyword = filters.search.trim();
      if (!keyword && hasFilters) {
        const filterParts = [];
        if (selectedCategoryId) filterParts.push(`Category`);
        if (filters.style) filterParts.push(`Style: ${getStyleLabel(filters.style)}`);
        if (filters.gender) filterParts.push(`Gender: ${filters.gender}`);
        if (filters.occasion) filterParts.push(`Occasion: ${getOccasionLabel(filters.occasion)}`);
        keyword = `[Bộ lọc] ${filterParts.join(" | ")}`;
      }

      trackBehavior(token, {
        actionType: "search",
        source: "category",
        searchKeyword: keyword,
        metadata: {
          categoryId: selectedCategoryId || null,
          style: filters.style || "",
          gender: filters.gender || "",
          occasion: filters.occasion || ""
        }
      });
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [filters, selectedCategoryId, token]);

  const productsWithVariants = useMemo(
    () => attachVariantsToProducts(products, variants),
    [products, variants],
  );

  const filterOptions = useMemo(
    () => buildCatalogFilters(productsWithVariants),
    [productsWithVariants],
  );

  const categoryScope = useMemo(
    () => collectCategoryScope(categories, selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const baseFilteredProducts = useMemo(() => {
    const byPanelFilters = filterProducts(productsWithVariants, filters);
    if (!selectedCategoryId) return byPanelFilters;
    return byPanelFilters.filter((product) =>
      categoryScope.has(getCategoryIdFromProduct(product)),
    );
  }, [productsWithVariants, filters, selectedCategoryId, categoryScope]);

  const filteredProducts = useMemo(() => {
    const data = [...baseFilteredProducts];
    if (sortBy === "price_asc")
      data.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === "price_desc")
      data.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === "name_asc")
      data.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
    if (sortBy === "newest")
      data.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    return data;
  }, [baseFilteredProducts, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const startIndex = (normalizedCurrentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredProducts, normalizedCurrentPage]);

  const selectedRootCategoryId = useMemo(
    () => getRootCategoryId(categories, selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const breadcrumbPath = useMemo(
    () => findCategoryPath(categories, selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const selectedNode = useMemo(
    () => categories.find((item) => item._id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
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
    return sortByCreatedAt(
      categories.filter((category) => getParentId(category) === quickTagBaseId),
    );
  }, [categories, quickTagBaseId]);

  const selectedScopeForTag = selectedCategoryId || quickTagBaseId || "";

  const selectedCategoryLabel = selectedNode?.name || "Tất cả sản phẩm";

  const categoryLevel1 = useMemo(
    () => sortByCreatedAt(categories.filter((item) => !getParentId(item))),
    [categories],
  );

  const selectedLevel1Id = useMemo(() => {
    if (!selectedCategoryId) return "";
    return breadcrumbPath[0]?._id || "";
  }, [selectedCategoryId, breadcrumbPath]);

  const categoryLevel2 = useMemo(() => {
    if (!selectedLevel1Id) return [];
    return sortByCreatedAt(
      categories.filter((item) => getParentId(item) === selectedLevel1Id),
    );
  }, [categories, selectedLevel1Id]);

  const selectedLevel2Id = useMemo(() => {
    if (breadcrumbPath.length >= 2) return breadcrumbPath[1]?._id || "";
    return "";
  }, [breadcrumbPath]);

  const categoryLevel3 = useMemo(() => {
    if (!selectedLevel2Id) return [];
    return sortByCreatedAt(
      categories.filter((item) => getParentId(item) === selectedLevel2Id),
    );
  }, [categories, selectedLevel2Id]);

  const handleSelectCategory = (categoryId) => {
    const next = new URLSearchParams(searchParams);
    if (categoryId) next.set("categoryId", categoryId);
    else next.delete("categoryId");
    setSearchParams(next);
    setShowMobileCategoryPanel(false);
  };

  const handleSelectQuickTag = (tagCategoryId) => {
    handleSelectCategory(tagCategoryId);
  };
  function getOccasionLabel(occasion) {
    const map = {
      casual: "Thường ngày",
      work: "Đi làm",
      party: "Tiệc tùng",
      date: "Hẹn hò",
      travel: "Du lịch",
      sport: "Thể thao",
      formal: "Trang trọng",
      street: "Dạo phố",
    };
    return map[occasion] || occasion;
  }

  function getStyleLabel(style) {
    const map = {
      casual: "Thường ngày (Casual)",
      minimal: "Tối giản (Minimal)",
      streetwear: "Đường phố (Streetwear)",
      elegant: "Thanh lịch (Elegant)",
      sporty: "Thể thao (Sporty)",
      vintage: "Cổ điển (Vintage)",
      smart_casual: "Công sở năng động (Smart Casual)",
    };
    return map[style] || style;
  }

  const clearFiltersKeepCategory = () => {
    setFilters({ search: "", style: "", gender: "", occasion: "", soldOnly: isBestSellerContext });
    setSortBy("newest");
  };

  const activeFilterChips = [
    selectedCategoryId
      ? { key: "category", label: `Danh mục: ${selectedCategoryLabel}` }
      : null,
    filters.search
      ? { key: "search", label: `Từ khóa: ${filters.search}` }
      : null,
    filters.style
      ? { key: "style", label: `Phong cách: ${getStyleLabel(filters.style)}` }
      : null,
    filters.gender
      ? {
        key: "gender",
        label: `Giới tính: ${filters.gender === "male" ? "Nam" : "Nữ"}`,
      }
      : null,
    filters.occasion
      ? { key: "occasion", label: `Dịp sử dụng: ${getOccasionLabel(filters.occasion)}` }
      : null,
    sortBy !== "newest"
      ? { key: "sort", label: `Sắp xếp: ${sortLabelMap[sortBy]}` }
      : null,
  ].filter(Boolean);

  const clearSingleChip = (key) => {
    if (key === "category") {
      handleSelectCategory("");
      return;
    }
    if (key === "sort") {
      setSortBy("newest");
      return;
    }
    setFilters((current) => ({ ...current, [key]: "" }));
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
          addedFrom: "product_page",
        },
      });
      setMessage(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);
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
          source: "product_page",
        },
      });

      setMessage(`Đã thêm ${formatProductName(product.name)} vào giỏ hàng`);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy, selectedCategoryId, isBestSellerContext, isNewArrivalsContext]);

  const inputClass =
    "w-full appearance-none border border-gray-200 bg-white px-4 py-2.5 text-sm text-black transition-colors focus:border-black focus:outline-none";
  const labelClass =
    "mb-2 block text-[13px] font-semibold text-black";

  return (
    /* Container */
    <div className="bg-[#f6f6f6] pb-16 pt-6">
      <section className="mx-auto w-full max-w-[1400px] px-4 lg:px-8">
        <div className="border border-gray-300 bg-white px-5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[15px]">
              <span className="font-semibold text-black">
                {filteredProducts.length} Sản phẩm
              </span>
              <span className="text-gray-400">&gt;</span>
              <Link to="/" className="text-gray-600 hover:text-black">
                Trang chủ
              </Link>
              <span className="text-gray-400">&gt;</span>

              {breadcrumbPath.length ? (
                breadcrumbPath.map((item, index) => (
                  <span
                    key={item._id}
                    className="inline-flex items-center gap-3"
                  >
                    <span
                      className={
                        index === breadcrumbPath.length - 1
                          ? "font-semibold text-black"
                          : "text-gray-600"
                      }
                    >
                      {item.name}
                    </span>
                    {index !== breadcrumbPath.length - 1 ? (
                      <span className="text-gray-400">&gt;</span>
                    ) : null}
                  </span>
                ))
              ) : (
                <>
                  <span className="text-gray-600">Tất cả sản phẩm</span>
                  {isNewArrivalsContext ? (
                    <>
                      <span className="text-gray-400">&gt;</span>
                      <span className="font-semibold text-black">Sản phẩm mới</span>
                    </>
                  ) : null}
                  {isBestSellerContext ? (
                    <>
                      <span className="text-gray-400">&gt;</span>
                      <span className="font-semibold text-black">Sản phẩm bán chạy nhất</span>
                    </>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`grid h-9 w-9 place-items-center border transition ${showFilterPanel
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-black"
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
                className={`grid h-9 w-9 place-items-center border transition ${viewMode === "grid"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-black"
                  }`}
                aria-label="Chế độ lưới"
              >
                <LayoutGrid size={16} />
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`grid h-9 w-9 place-items-center border transition ${viewMode === "list"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-black"
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
            <div
              ref={tagsRef}
              className="scrollbar-hide flex-1 overflow-x-auto whitespace-nowrap"
            >
              <div className="inline-flex gap-2">
                {quickTagBaseId ? (
                  <button
                    type="button"
                    onClick={() => handleSelectQuickTag(quickTagBaseId)}
                    className={`border px-5 py-3 text-[15px] font-medium transition ${selectedScopeForTag === quickTagBaseId
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
                    className={`border px-5 py-3 text-[15px] font-medium transition ${selectedScopeForTag === tag._id
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-black hover:border-black"
                      }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showFilterPanel ? (
          <div className="mt-6 mb-6 grid grid-cols-1 gap-5 border border-gray-200 bg-white p-5 md:grid-cols-4">
            <label className="block min-w-0">
              <span className={labelClass}>Tìm kiếm</span>
              <input
                className={`${inputClass} w-full`}
                placeholder="Tìm kiếm sản phẩm..."
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block min-w-0">
              <span className={labelClass}>Phong cách</span>
              <select
                className={`${inputClass} w-full`}
                value={filters.style}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    style: event.target.value,
                  }))
                }
              >
                <option value="">Tất cả</option>
                {filterOptions.styles.map((item) => (
                  <option key={item} value={item}>
                    {getStyleLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className={labelClass}>Giới tính</span>
              <select
                className={`${inputClass} w-full`}
                value={filters.gender}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    gender: event.target.value,
                  }))
                }
              >
                <option value="">Tất cả</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </label>

            <label className="block min-w-0">
              <span className={labelClass}>Dịp sử dụng</span>
              <select
                className={`${inputClass} w-full`}
                value={filters.occasion}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    occasion: event.target.value,
                  }))
                }
              >
                <option value="">Tất cả</option>
                {filterOptions.occasions.map((item) => (
                  <option key={item} value={item}>
                    {getOccasionLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <div className="col-span-full flex justify-end">
              <button
                type="button"
                className="border border-black px-4 py-2 text-[13px] font-bold transition hover:bg-black hover:text-white"
                onClick={clearFiltersKeepCategory}
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="mt-4 border-l-4 border-black bg-gray-100 px-4 py-3 text-sm text-black">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {useNewAllProductsLayout && activeFilterChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearSingleChip(chip.key)}
                className="inline-flex items-center gap-1 border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-black hover:border-black"
              >
                {chip.label}
                <X size={12} />
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={`mt-6 ${useNewAllProductsLayout ? "grid gap-4 lg:grid-cols-[210px_1fr]" : ""}`}
        >
          {useNewAllProductsLayout ? (
            <aside className="hidden lg:block border border-gray-200 bg-white p-4 h-fit sticky top-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-black">
                  Danh mục
                </h3>
                <button
                  type="button"
                  onClick={() => handleSelectCategory("")}
                  className="text-xs text-gray-500 hover:text-black"
                >
                </button>
              </div>

              <div className="space-y-1">
                {categoryLevel1.map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => handleSelectCategory(cat._id)}
                    className={`w-full text-left px-2 py-2 text-sm ${selectedLevel1Id === cat._id ? "bg-black text-white" : "text-black hover:bg-gray-100"}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {categoryLevel2.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3 space-y-1">
                  {categoryLevel2.map((cat) => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => handleSelectCategory(cat._id)}
                      className={`w-full text-left px-2 py-1.5 text-sm ${selectedLevel2Id === cat._id ? "font-semibold text-black" : "text-gray-600 hover:text-black"}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {categoryLevel3.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
                  {categoryLevel3.map((cat) => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => handleSelectCategory(cat._id)}
                      className={`w-full text-left px-2 py-1.5 text-sm ${selectedCategoryId === cat._id ? "font-semibold text-black" : "text-gray-600 hover:text-black"}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </aside>
          ) : null}

          <div>
            <div className="mb-3 lg:hidden">
              <button
                type="button"
                onClick={() => setShowMobileCategoryPanel((prev) => !prev)}
                className="inline-flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                Danh mục
                <ChevronDown size={16} />
              </button>
            </div>

            {showMobileCategoryPanel && (
              <div className="mb-4 border border-gray-200 bg-white p-3 lg:hidden">
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectCategory("")}
                    className="border border-gray-300 px-3 py-2 text-left text-sm"
                  >
                    Tất cả sản phẩm
                  </button>
                  {[
                    ...categoryLevel1,
                    ...categoryLevel2,
                    ...categoryLevel3,
                  ].map((cat) => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => handleSelectCategory(cat._id)}
                      className={`px-3 py-2 text-left text-sm border ${selectedCategoryId === cat._id ? "border-black bg-black text-white" : "border-gray-300 bg-white"}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {paginatedProducts.length === 0 ? (
              <div className="border border-gray-200 bg-white py-24 text-center">
                <h3 className="mb-2 text-lg font-semibold text-black">
                  Không tìm thấy sản phẩm
                </h3>
                <p className="text-sm text-gray-500">
                  Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn.
                </p>
              </div>
            ) : (
              <div
                className={
                  viewMode === "list"
                    ? "grid grid-cols-1 gap-4"
                    : "grid grid-cols-2 gap-[1px] bg-gray-200 md:grid-cols-3 xl:grid-cols-4"
                }
              >
                {paginatedProducts.map((product) => {
                  const colorGroups = getColorGroups(product);
                  const activeColorName =
                    activeSwatchByProduct[product._id] || colorGroups[0]?.color;
                  const activeColorGroup =
                    colorGroups.find(
                      (group) => group.color === activeColorName,
                    ) || colorGroups[0];
                  const primaryImage =
                    activeColorGroup?.previewImage ||
                    product.images?.[0] ||
                    "https://placehold.co/900x1200/F5F5F5/222?text=Fashion";
                  const secondaryImage =
                    product.images?.[1] ||
                    activeColorGroup?.variants?.find(
                      (item) => item.image && item.image !== primaryImage,
                    )?.image ||
                    primaryImage;

                  const sizes = sortSizes([
                    ...new Set(
                      (activeColorGroup?.variants || [])
                        .map((item) => item.size)
                        .filter(Boolean),
                    ),
                  ]);
                  const quickAdd = quickAddByProduct[product._id];
                  const selectedSize = quickAdd?.size || sizes[0] || "";
                  const selectedVariant =
                    (activeColorGroup?.variants || []).find(
                      (item) => item.size === selectedSize,
                    ) ||
                    activeColorGroup?.variants?.[0] ||
                    null;
                  const displayName = formatProductName(product.name);

                  return (
                    <article
                      key={product._id}
                      className={`group bg-white ${viewMode === "list" ? "grid grid-cols-1 gap-4 border border-gray-200 p-4 md:grid-cols-[220px_minmax(0,1fr)_300px] md:items-center" : ""}`}
                    >
                      <div className="relative overflow-hidden bg-gray-100 border-t border-gray-200">
                        <Link
                          to={getProductPath(product, {
                            color: activeColorName,
                          })}
                          className="absolute inset-0 block"
                        >
                          <img
                            src={primaryImage}
                            alt={displayName}
                            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                          />
                          <img
                            src={secondaryImage}
                            alt={displayName}
                            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          />
                        </Link>

                        <div
                          className={`${viewMode === "list" ? "aspect-[4/5]" : "aspect-[4/5]"}`}
                        />

                        {viewMode !== "list" ? (
                          <>
                            <div className="absolute inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur-[1px]">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  {productCollectionMap.get(product._id) ? (
                                    <p className="line-clamp-1 text-[12px] font-bold uppercase text-red-600">
                                      {productCollectionMap.get(product._id)}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400"></p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickAddToggle(product._id, sizes[0])
                                  }
                                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-bold uppercase transition ${quickAdd ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black hover:border-black"}`}
                                  aria-label="Thêm nhanh vào giỏ"
                                >
                                  {quickAdd ? <X size={13} /> : <Plus size={13} />}
                                  {quickAdd ? "Đóng" : "Thêm"}
                                </button>
                              </div>
                            </div>

                            {quickAdd ? (
                              <div className="absolute bottom-14 right-2 z-10 w-44 border border-gray-200 bg-white p-3 shadow-xl">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                                  Chọn size
                                </p>
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {(sizes.length ? sizes : ["M"]).map((size) => {
                                    const variantForSize =
                                      (activeColorGroup?.variants || []).find((item) => item.size === size) || null;
                                    const isOutOfStock = Number(variantForSize?.stock || 0) <= 0;

                                    return (
                                      <button
                                        key={size}
                                        type="button"
                                        onClick={() => !isOutOfStock && handleQuickAddSize(product._id, size)}
                                        disabled={isOutOfStock}
                                        className={`relative h-8 w-8 border text-xs font-medium transition ${isOutOfStock
                                          ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                                          : selectedSize === size
                                            ? "border-black bg-black text-white"
                                            : "border-gray-300 bg-white text-black hover:border-black"
                                          }`}
                                      >
                                        {size}
                                        {isOutOfStock ? (
                                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                                            <span className="h-[1px] w-[140%] -rotate-45 bg-gray-400" />
                                          </span>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddToCart(product, selectedVariant)
                                  }
                                  disabled={!selectedVariant || Number(selectedVariant?.stock || 0) <= 0}
                                  className="w-full bg-black py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {Number(selectedVariant?.stock || 0) <= 0 ? "Hết hàng" : "Thêm giỏ hàng"}
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      <div
                        className={`${viewMode === "list" ? "pt-2 md:pt-0" : "px-3 py-3"} bg-white`}
                      >
                        {viewMode === "list" && productCollectionMap.get(product._id) ? (
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-red-600">
                            {productCollectionMap.get(product._id)}
                          </p>
                        ) : null}

                        <h2 className="text-[16px] font-semibold leading-tight text-black md:text-[17px]">
                          <Link
                            to={getProductPath(product, {
                              color: activeColorName,
                            })}
                            className="hover:text-red-600"
                          >
                            {displayName}
                          </Link>
                        </h2>

                        <div className="mt-3 flex items-center gap-2">
                          {colorGroups.slice(0, 6).map((group) => (
                            <button
                              key={`${product._id}-${group.color}`}
                              type="button"
                              title={group.color}
                              onMouseEnter={() =>
                                setActiveSwatchByProduct((current) => ({
                                  ...current,
                                  [product._id]: group.color,
                                }))
                              }
                              onClick={() =>
                                setActiveSwatchByProduct((current) => ({
                                  ...current,
                                  [product._id]: group.color,
                                }))
                              }
                              className={`relative overflow-hidden w-8 h-10 border transition-all p-0 m-0 bg-white ${activeColorName === group.color
                                ? "border-black"
                                : "border-gray-200 opacity-70 hover:opacity-100"
                                }`}
                            >
                              {group.previewImage ? (
                                <img
                                  src={group.previewImage}
                                  alt={group.color}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[8px] font-bold uppercase tracking-widest text-center flex items-center justify-center h-full w-full leading-tight px-0.5">
                                  {group.color}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        {viewMode !== "list" ? (
                          <div className="mt-3 flex items-center justify-between">
                            <p className="text-[16px] font-semibold text-black">
                              {formatPrice(
                                product.price +
                                (selectedVariant?.priceAdjustment || 0),
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => toggleWishlist(product)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${wishlistProductIds.has(product._id) ? "text-red-600" : "text-gray-500 hover:text-red-600"}`}
                            >
                              <Heart
                                size={13}
                                className={
                                  wishlistProductIds.has(product._id)
                                    ? "fill-red-600 text-red-600"
                                    : "text-current"
                                }
                              />
                              Yêu thích
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-gray-500">
                            {activeColorName} {selectedVariant?.size ? `• Size ${selectedVariant.size}` : ""}
                          </div>
                        )}
                      </div>

                      {viewMode === "list" ? (
                        <div className="border-t border-gray-200 pt-3 md:border-t-0 md:border-l md:border-gray-200 md:pl-4 md:pt-0">
                          <p className="text-right text-xl font-bold text-black md:text-2xl">
                            {formatPrice(product.price + (selectedVariant?.priceAdjustment || 0))}
                          </p>

                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => toggleWishlist(product)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${wishlistProductIds.has(product._id) ? "text-red-600" : "text-gray-500 hover:text-red-600"}`}
                            >
                              <Heart
                                size={13}
                                className={
                                  wishlistProductIds.has(product._id)
                                    ? "fill-red-600 text-red-600"
                                    : "text-current"
                                }
                              />
                              Yêu thích
                            </button>
                          </div>

                          <div className="mt-4">
                            <p className="mb-2 text-right text-[11px] font-semibold uppercase text-gray-500">Chọn size nhanh</p>
                            <div className="mb-3 flex flex-wrap justify-end gap-2">
                              {(sizes.length ? sizes : ["M"]).map((size) => {
                                const variantForSize =
                                  (activeColorGroup?.variants || []).find((item) => item.size === size) || null;
                                const isOutOfStock = Number(variantForSize?.stock || 0) <= 0;

                                return (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => !isOutOfStock && handleQuickAddSize(product._id, size)}
                                    disabled={isOutOfStock}
                                    className={`relative h-8 min-w-[36px] border px-2 text-xs font-medium transition ${isOutOfStock
                                      ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                                      : selectedSize === size
                                        ? "border-black bg-black text-white"
                                        : "border-gray-300 bg-white text-black hover:border-black"
                                      }`}
                                  >
                                    {size}
                                    {isOutOfStock ? (
                                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                                        <span className="h-[1px] w-[140%] -rotate-45 bg-gray-400" />
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddToCart(product, selectedVariant)}
                              disabled={!selectedVariant || Number(selectedVariant?.stock || 0) <= 0}
                              className="w-full border border-black bg-black py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {Number(selectedVariant?.stock || 0) <= 0 ? "Hết hàng" : "Thêm vào giỏ"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > PAGE_SIZE ? (
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={normalizedCurrentPage === 1}
                  className="grid h-9 w-9 place-items-center border border-gray-300 bg-white text-sm font-medium text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &lt;
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    return Math.abs(page - normalizedCurrentPage) <= 1;
                  })
                  .map((page, index, pages) => {
                    const prevPage = pages[index - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;
                    return (
                      <span key={`page-wrap-${page}`} className="inline-flex items-center gap-2">
                        {showEllipsis ? <span className="px-1 text-gray-500">...</span> : null}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`grid h-9 min-w-9 place-items-center border px-2 text-sm font-medium transition ${page === normalizedCurrentPage
                            ? "border-black bg-black text-white"
                            : "border-gray-300 bg-white text-black hover:border-black"
                            }`}
                        >
                          {page}
                        </button>
                      </span>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={normalizedCurrentPage === totalPages}
                  className="grid h-9 w-9 place-items-center border border-gray-300 bg-white text-sm font-medium text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &gt;
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
