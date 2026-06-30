import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronDown,
  Heart,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
  SortAsc,
  X,
  ChevronsRight,
  ChevronsLeft,
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
import { getPaginationRange } from "../lib/pagination.js";
import {
  FALLBACK_PRODUCT_IMAGE,
  findFirstDistinctImage,
  getProductGalleryImageUrls,
  getProductImageUrls
} from "../lib/productImages.js";
import toast from "react-hot-toast";

/* ─── helpers (giữ nguyên từ ProductsPage) ─── */

function colorToHex(color) {
  const map = {
    den: "#111111", black: "#111111",
    trang: "#F4F4F5", white: "#F4F4F5",
    navy: "#243447", xanh: "#1D4ED8",
    do: "#DC2626", red: "#DC2626",
    xam: "#6B7280", gray: "#6B7280",
    be: "#D6C6AE", kem: "#EFE7DA",
    nau: "#7C4A2D", brown: "#7C4A2D",
  };
  return map[(color || "").trim().toLowerCase()] || "#9CA3AF";
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
      group.previewImage = getProductImageUrls(product)[0] || "";
    }
  });

  if (groups.size === 0) {
    groups.set("Mặc định", {
      color: "Mặc định",
      hex: "#9CA3AF",
      previewImage: getProductImageUrls(product)[0] || "",
      variants: [],
    });
  }

  return [...groups.values()];
}

function formatPrice(price) {
  return `${Number(price || 0).toLocaleString("vi-VN")} đ`;
}

function getProductDisplayPrice(product) {
  const colorGroups = getColorGroups(product);
  const group = colorGroups[0];
  const sizes = sortSizes([
    ...new Set((group?.variants || []).map((item) => item.size).filter(Boolean)),
  ]);
  const selectedSize = sizes[0] || "";
  const variant =
    (group?.variants || []).find((item) => item.size === selectedSize) ||
    group?.variants?.[0] ||
    null;
  const basePrice = Number(product.price || 0);
  const priceAdjustment = Number(variant?.priceAdjustment || 0);
  const priceBeforeDiscount = basePrice + priceAdjustment;
  const productDiscount = product.discount || 0;
  const variantDiscount = variant?.discount;
  const effectiveDiscount =
    variantDiscount !== null && variantDiscount !== undefined
      ? variantDiscount
      : productDiscount;
  return effectiveDiscount > 0
    ? Math.round(priceBeforeDiscount * (1 - effectiveDiscount / 100))
    : priceBeforeDiscount;
}

function getOccasionLabel(occasion) {
  const map = {
    casual: "Thường ngày", work: "Đi làm", party: "Tiệc tùng",
    date: "Hẹn hò", travel: "Du lịch", sport: "Thể thao",
    formal: "Trang trọng", street: "Dạo phố",
  };
  return map[occasion] || occasion;
}

function getStyleLabel(style) {
  const map = {
    casual: "Thường ngày (Casual)", minimal: "Tối giản (Minimal)",
    streetwear: "Đường phố (Streetwear)", elegant: "Thanh lịch (Elegant)",
    sporty: "Thể thao (Sporty)", vintage: "Cổ điển (Vintage)",
    smart_casual: "Công sở năng động (Smart Casual)",
  };
  return map[style] || style;
}

const sortSequence = ["newest", "price_asc", "price_desc", "name_asc"];
const sortLabelMap = {
  newest: "Mới nhất",
  price_asc: "Giá tăng",
  price_desc: "Giá giảm",
  name_asc: "Tên A-Z",
};

const PAGE_SIZE = 16;

/* ─── Component chính ─── */

export default function CollectionDetailPage() {
  const { collectionId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [collection, setCollection] = useState(null);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");
  const [activeSwatchByProduct, setActiveSwatchByProduct] = useState({});
  const [quickAddByProduct, setQuickAddByProduct] = useState({});
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());
  const [filters, setFilters] = useState({
    search: "",
    style: "",
    gender: "",
    occasion: "",
    soldOnly: false,
    discountOnly: false,
  });

  /* ─── Data loading ─── */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Lấy thông tin bộ sưu tập (bao gồm danh sách productId)
        let colRes;
        try {
          colRes = await apiRequest(`/collections/slug/${collectionId}`);
        } catch {
          colRes = await apiRequest(`/collections/${collectionId}`);
        }
        const col = colRes.data;
        setCollection(col);

        const productIds = (col.products || []).map((p) => p._id || p);

        // 2. Lấy full products + variants + wishlist song song
        const requests = [
          apiRequest("/products?limit=500"),
          apiRequest("/product-variants?limit=2000"),
        ];
        if (token) {
          requests.push(apiRequest("/wishlists/me", { token }));
        }

        const [prodRes, varRes, wishRes] = await Promise.all(requests);

        // 3. Chỉ giữ lại sản phẩm thuộc bộ sưu tập này
        const allProducts = prodRes.data || [];
        const collectionProducts = allProducts.filter((p) =>
          productIds.includes(p._id)
        );
        setProducts(collectionProducts);

        // 4. Chỉ giữ variants thuộc những sản phẩm đó
        const allVariants = varRes.data || [];
        setVariants(
          allVariants.filter((v) =>
            productIds.includes(v.productId?._id || v.productId)
          )
        );

        // 5. Wishlist
        if (wishRes) {
          setWishlistProductIds(
            new Set(
              (wishRes.data?.items || [])
                .map((item) => item.productId?._id)
                .filter(Boolean)
            )
          );
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu trang bộ sưu tập:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    window.scrollTo(0, 0);
  }, [collectionId, token]);

  /* ─── Computed data ─── */
  const productsWithVariants = useMemo(() => {
    return attachVariantsToProducts(products, variants).map((product) => ({
      ...product,
      collectionName: collection?.name || null,
    }));
  }, [products, variants, collection]);

  const filterOptions = useMemo(
    () => buildCatalogFilters(productsWithVariants),
    [productsWithVariants],
  );

  const baseFilteredProducts = useMemo(() => {
    return filterProducts(productsWithVariants, filters);
  }, [productsWithVariants, filters]);

  const filteredProducts = useMemo(() => {
    const data = [...baseFilteredProducts];
    if (sortBy === "price_asc")
      data.sort((a, b) => getProductDisplayPrice(a) - getProductDisplayPrice(b));
    if (sortBy === "price_desc")
      data.sort((a, b) => getProductDisplayPrice(b) - getProductDisplayPrice(a));
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

  /* ─── Reset page khi thay đổi bộ lọc / sắp xếp ─── */
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy]);

  /* ─── Handlers ─── */
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
        toast.success(`Đã bỏ ${formatProductName(product.name)} khỏi danh sách yêu thích`);
        trackBehavior(token, {
          actionType: "remove_from_wishlist",
          productId: product._id,
          source: "collection",
        });
      } else {
        await apiRequest("/wishlists/me", {
          method: "POST",
          token,
          body: { productId: product._id, addedFrom: "collection" },
        });
        setWishlistProductIds((current) => new Set([...current, product._id]));
        toast.success(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);
        trackBehavior(token, {
          actionType: "add_to_wishlist",
          productId: product._id,
          source: "collection",
        });
      }
    } catch (requestError) {
      toast.error(requestError.message);
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
      toast.error("Sản phẩm chưa có biến thể phù hợp để thêm vào giỏ hàng.");
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
          source: "collection",
        },
      });

      toast.success(`Đã thêm ${formatProductName(product.name)} vào giỏ hàng`);
      setQuickAddByProduct((current) => {
        const clone = { ...current };
        delete clone[product._id];
        return clone;
      });
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const handleSortToggle = () => {
    const currentIndex = sortSequence.indexOf(sortBy);
    const nextValue = sortSequence[(currentIndex + 1) % sortSequence.length];
    setSortBy(nextValue);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      style: "",
      gender: "",
      occasion: "",
      soldOnly: false,
      discountOnly: false,
    });
    setSortBy("newest");
  };

  const activeFilterChips = [
    filters.search
      ? { key: "search", label: `Từ khóa: ${filters.search}` }
      : null,
    filters.style
      ? { key: "style", label: `Phong cách: ${getStyleLabel(filters.style)}` }
      : null,
    filters.gender
      ? { key: "gender", label: `Giới tính: ${filters.gender === "male" ? "Nam" : "Nữ"}` }
      : null,
    filters.occasion
      ? { key: "occasion", label: `Dịp sử dụng: ${getOccasionLabel(filters.occasion)}` }
      : null,
    filters.discountOnly
      ? { key: "discountOnly", label: "Đang giảm giá" }
      : null,
    sortBy !== "newest"
      ? { key: "sort", label: `Sắp xếp: ${sortLabelMap[sortBy]}` }
      : null,
  ].filter(Boolean);

  const clearSingleChip = (key) => {
    if (key === "sort") {
      setSortBy("newest");
      return;
    }
    if (key === "discountOnly") {
      setFilters((current) => ({ ...current, discountOnly: false }));
      return;
    }
    setFilters((current) => ({ ...current, [key]: "" }));
  };

  const handleWishlist = async (product) => {
    await toggleWishlist(product);
  };

  const inputClass =
    "w-full appearance-none border border-gray-200 bg-white px-4 py-2.5 text-sm text-black transition-colors focus:border-black focus:outline-none";
  const labelClass =
    "mb-2 block text-[13px] font-semibold text-black";

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </section>
    );
  }

  if (!collection) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-bold">Không tìm thấy</h2>
          <p className="mb-6 text-sm text-gray-500">
            Bộ sưu tập này không tồn tại hoặc đã bị xóa.
          </p>
          <Link
            to="/collections"
            className="bg-black px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-800"
          >
            Xem tất cả bộ sưu tập
          </Link>
        </div>
      </section>
    );
  }

  const bannerImage = collection.bannerImage || collection.coverImage;

  /* ─── Render ─── */
  return (
    <div className="bg-[#f6f6f6] pb-16 pt-6">
      {/* Banner */}
      <section className="mb-6 overflow-hidden bg-gray-100 mx-auto max-w-[1400px] px-4 lg:px-8">
        {bannerImage ? (
          <img src={bannerImage} alt={collection.name} className="h-auto w-full object-cover" />
        ) : (
          <div className="grid aspect-[16/5] place-items-center bg-gray-100 px-6 text-center">
            <div>
              <h1 className="mb-2 text-3xl font-extrabold uppercase tracking-wide text-black md:text-5xl">
                {collection.name}
              </h1>
              {collection.description && (
                <p className="mx-auto max-w-2xl text-sm leading-6 text-gray-500">{collection.description}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {collection.description && (
        <section className="mb-6 mx-auto max-w-[1400px] px-4 lg:px-8">
          <h1 className="mb-3 text-2xl font-extrabold uppercase tracking-wide text-black md:text-3xl">
            {collection.name}
          </h1>
          <p className="m-0 text-sm leading-7 text-gray-500 text-justify">{collection.description}</p>
        </section>
      )}

      <section className="mx-auto w-full max-w-[1400px] px-4 lg:px-8">
        {/* Breadcrumb + Toolbar */}
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
              <Link to="/collections" className="text-gray-600 hover:text-black">
                Bộ sưu tập
              </Link>
              <span className="text-gray-400">&gt;</span>
              <span className="font-semibold text-black">{collection.name}</span>
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

        {/* Filter Panel */}
        {showFilterPanel ? (
          <div className="mt-2 mb-6 grid grid-cols-1 gap-5 border border-gray-200 bg-white p-5 md:grid-cols-4">
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

            <div className="col-span-full flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.discountOnly}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      discountOnly: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                Chỉ sản phẩm đang giảm giá
              </label>
              <button
                type="button"
                className="border border-black px-4 py-2 text-[13px] font-bold transition hover:bg-black hover:text-white"
                onClick={clearFilters}
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        ) : null}

        {/* Active filter chips */}
        {activeFilterChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
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

        {/* Product Grid/List */}
        <div className="mt-6">
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
                const productImageUrls = getProductImageUrls(product);
                const primaryImage =
                  activeColorGroup?.previewImage ||
                  productImageUrls[0] ||
                  FALLBACK_PRODUCT_IMAGE;
                const secondaryImage =
                  findFirstDistinctImage(
                    [
                      ...getProductGalleryImageUrls(product, activeColorGroup?.color),
                      ...productImageUrls,
                      ...(activeColorGroup?.variants || []).map((item) => item.image),
                    ],
                    primaryImage,
                  ) ||
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
                const basePrice = Number(product.price || 0);
                const priceAdjustment = Number(
                  selectedVariant?.priceAdjustment || 0,
                );
                const priceBeforeDiscount = basePrice + priceAdjustment;
                const productDiscount = product.discount || 0;
                const variantDiscount = selectedVariant?.discount;
                const effectiveDiscount =
                  variantDiscount !== null && variantDiscount !== undefined
                    ? variantDiscount
                    : productDiscount;
                const displayPrice =
                  effectiveDiscount > 0
                    ? Math.round(
                      priceBeforeDiscount * (1 - effectiveDiscount / 100),
                    )
                    : priceBeforeDiscount;

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
                          onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_PRODUCT_IMAGE; }}
                        />
                        <img
                          src={secondaryImage}
                          alt={displayName}
                          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_PRODUCT_IMAGE; }}
                        />
                      </Link>

                      <div className="aspect-[4/5]" />

                      {viewMode !== "list" ? (
                        <>
                          <div className="absolute inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur-[1px]">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                {product.collectionName ? (
                                  <p className="line-clamp-1 text-[12px] font-bold uppercase text-red-600">
                                    {product.collectionName}
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
                            <div className="absolute bottom-14 right-2 z-10 w-50 border border-gray-200 bg-white p-3 shadow-xl">
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
                                className="w-full bg-black py-2 px-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
                      {viewMode === "list" && product.collectionName ? (
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-red-600">
                          {product.collectionName}
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
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="m-0 text-[16px] font-semibold text-black">
                              {formatPrice(displayPrice)}
                            </p>
                            {effectiveDiscount > 0 ? (
                              <>
                                <p className="m-0 text-[16px] font-normal text-gray-400 line-through decoration-gray-400 decoration-[1px]">
                                  {formatPrice(priceBeforeDiscount)}
                                </p>
                                <span
                                  className="inline-flex items-center bg-red-600 py-0.5 pl-2 pr-1.5 text-[12px] font-bold leading-none text-white"
                                  style={{
                                    clipPath:
                                      "polygon(18% 0%, 100% 0%, 100% 100%, 6px 100%, 0% 50%)",
                                  }}
                                >
                                  -{effectiveDiscount}%
                                </span>
                              </>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(product)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium transition text-red-600 hover:text-red-400"
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
                        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                          <p className="m-0 text-right text-xl font-bold text-black md:text-2xl">
                            {formatPrice(displayPrice)}
                          </p>
                          {effectiveDiscount > 0 ? (
                            <>
                              <p className="m-0 text-right text-base font-normal text-gray-400 line-through decoration-gray-400 decoration-[1px]">
                                {formatPrice(priceBeforeDiscount)}
                              </p>
                              <span
                                className="inline-flex items-center bg-red-600 py-0.5 pl-2 pr-1.5 text-[12px] font-bold leading-none text-white"
                                style={{
                                  clipPath:
                                    "polygon(18% 0%, 100% 0%, 100% 100%, 6px 100%, 0% 50%)",
                                }}
                              >
                                -{effectiveDiscount}%
                              </span>
                            </>
                          ) : null}
                        </div>

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

          {/* Pagination */}
          {filteredProducts.length > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-center border-t border-gray-200 px-5 py-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={normalizedCurrentPage === 1}
                  className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                >
                  <ChevronsLeft size={18} />
                </button>

                <div className="flex items-center gap-1">
                  {getPaginationRange(normalizedCurrentPage, totalPages).map((p) => {
                    if (p === "left-ellipsis" || p === "right-ellipsis") {
                      return (
                        <span key={`ellipsis-${p}`} className="px-1 text-gray-400">...</span>
                      );
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${normalizedCurrentPage === p
                          ? "bg-black text-white"
                          : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                          }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={normalizedCurrentPage === totalPages}
                  className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Back to collections */}
        <section className="border-t border-gray-200 py-12 text-center mt-8">
          <Link
            to="/collections"
            className="inline-block bg-black px-10 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-800"
          >
            Xem tất cả bộ sưu tập
          </Link>
        </section>
      </section>
    </div>
  );
}
