import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, SortAsc, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";
import ProductCard from "./ProductCard.jsx";

function normalizeWishlistProduct(product = {}) {
  return {
    ...product,
    collectionName: product.collectionName || product.collectionId?.name || "",
    images: Array.isArray(product.images) ? product.images : [],
    availableVariants: Array.isArray(product.availableVariants)
      ? product.availableVariants
      : [],
  };
}

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

export default function WishlistTab({ token, onError }) {
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState({ totalItems: 0, items: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    style: "",
    gender: "",
    occasion: "",
  });
  const [sortBy, setSortBy] = useState("newest");
  const [wishlistVariantsByProductId, setWishlistVariantsByProductId] = useState({});

  const sortLabelMap = {
    newest: "Mới nhất",
    price_asc: "Giá tăng dần",
    price_desc: "Giá giảm dần",
    name_asc: "Tên A-Z",
  };
  const sortSequence = ["newest", "price_asc", "price_desc", "name_asc"];

  const inputClass =
    "w-full border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-black";
  const labelClass =
    "mb-2 block text-xs font-bold uppercase tracking-widest text-black";

  const loadWishlist = async () => {
    try {
      const response = await apiRequest("/wishlists/me", { token });
      const wishlistData = response.data || { totalItems: 0, items: [] };
      setWishlist(wishlistData);

      const productIds = (wishlistData.items || [])
        .map((item) => item.productId?._id)
        .filter(Boolean);

      if (!productIds.length) {
        setWishlistVariantsByProductId({});
        return;
      }

      const variantResponse = await apiRequest("/product-variants?limit=10000");
      const allVariants = variantResponse.data || [];

      const variantsByProductId = allVariants.reduce((acc, variant) => {
        const variantProductId = variant.productId?._id;
        if (!variantProductId || !productIds.includes(variantProductId)) return acc;
        if (!acc[variantProductId]) acc[variantProductId] = [];
        acc[variantProductId].push(variant);
        return acc;
      }, {});

      setWishlistVariantsByProductId(variantsByProductId);
    } catch (error) {
      onError?.(error.message);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, [token]);

  const styleOptions = useMemo(
    () =>
      [...new Set((wishlist.items || []).map((item) => item.productId?.style).filter(Boolean))],
    [wishlist.items],
  );

  const occasionOptions = useMemo(
    () =>
      [
        ...new Set(
          (wishlist.items || [])
            .flatMap((item) => item.productId?.occasion || [])
            .filter(Boolean),
        ),
      ],
    [wishlist.items],
  );

  const filteredItems = useMemo(() => {
    return (wishlist.items || []).filter((item) => {
      const product = item.productId || {};
      const keyword = filters.search.trim().toLowerCase();
      const searchMatch = !keyword || (product.name || "").toLowerCase().includes(keyword);
      const styleMatch = !filters.style || product.style === filters.style;
      const genderMatch = !filters.gender || product.gender === filters.gender;
      const occasionMatch =
        !filters.occasion || (product.occasion || []).includes(filters.occasion);
      return searchMatch && styleMatch && genderMatch && occasionMatch;
    });
  }, [wishlist.items, filters]);

  const sortedItems = useMemo(() => {
    const data = [...filteredItems];
    if (sortBy === "price_asc") {
      data.sort(
        (a, b) => Number(a.productId?.price || 0) - Number(b.productId?.price || 0),
      );
    }
    if (sortBy === "price_desc") {
      data.sort(
        (a, b) => Number(b.productId?.price || 0) - Number(a.productId?.price || 0),
      );
    }
    if (sortBy === "name_asc") {
      data.sort((a, b) =>
        (a.productId?.name || "").localeCompare(b.productId?.name || "", "vi"),
      );
    }
    if (sortBy === "newest") {
      data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return data;
  }, [filteredItems, sortBy]);

  const products = useMemo(() => {
    const baseProducts = sortedItems.map((item) => normalizeWishlistProduct(item.productId || {}));
    const attachedProducts = attachVariantsToProducts(
      baseProducts,
      Object.values(wishlistVariantsByProductId).flat(),
    );

    return attachedProducts.map((product) => ({
      ...product,
      availableVariants:
        product.availableVariants?.length
          ? product.availableVariants
          : wishlistVariantsByProductId[product._id] || [],
    }));
  }, [sortedItems, wishlistVariantsByProductId]);

  const activeFilterChips = [
    filters.search ? { key: "search", label: `Từ khóa: ${filters.search}` } : null,
    filters.style ? { key: "style", label: `Phong cách: ${filters.style}` } : null,
    filters.gender
      ? { key: "gender", label: `Giới tính: ${filters.gender === "male" ? "Nam" : "Nữ"}` }
      : null,
    filters.occasion
      ? { key: "occasion", label: `Dịp: ${getOccasionLabel(filters.occasion)}` }
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
    setFilters((current) => ({ ...current, [key]: "" }));
  };

  const clearFiltersKeepSort = () =>
    setFilters({ search: "", style: "", gender: "", occasion: "" });

  const handleSortToggle = () => {
    const currentIndex = sortSequence.indexOf(sortBy);
    const nextValue = sortSequence[(currentIndex + 1) % sortSequence.length];
    setSortBy(nextValue);
  };

  const removeWishlistItem = async (productId) => {
    try {
      await apiRequest(`/wishlists/me/product/${productId}`, { method: "DELETE", token });
      await loadWishlist();
    } catch (error) {
      onError?.(error.message);
    }
  };

  const handleAddToCart = async (product, variant) => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: variant?._id,
          quantity: 1,
          source: "wishlist",
        },
      });
    } catch (error) {
      onError?.(error.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-white px-4 py-4">
        <div>
          <h2 className="text-xl font-bold">Sản phẩm yêu thích</h2>
          <p className="mt-1 text-xs text-gray-500">Bạn đã lưu {wishlist.totalItems} sản phẩm</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`grid h-9 w-9 place-items-center border transition ${showFilters ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black"}`}
            onClick={() => setShowFilters((current) => !current)}
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
        </div>
      </div>

      {showFilters ? (
        <div className="grid gap-4 border border-gray-200 bg-white p-4 md:grid-cols-4">
          <label>
            <span className={labelClass}>Tìm kiếm</span>
            <input
              className={inputClass}
              value={filters.search}
              onChange={(e) =>
                setFilters((current) => ({ ...current, search: e.target.value }))
              }
              placeholder="Tìm theo tên sản phẩm..."
            />
          </label>
          <label>
            <span className={labelClass}>Phong cách</span>
            <select
              className={inputClass}
              value={filters.style}
              onChange={(e) =>
                setFilters((current) => ({ ...current, style: e.target.value }))
              }
            >
              <option value="">Tất cả</option>
              {styleOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Giới tính</span>
            <select
              className={inputClass}
              value={filters.gender}
              onChange={(e) =>
                setFilters((current) => ({ ...current, gender: e.target.value }))
              }
            >
              <option value="">Tất cả</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Dịp sử dụng</span>
            <select
              className={inputClass}
              value={filters.occasion}
              onChange={(e) =>
                setFilters((current) => ({ ...current, occasion: e.target.value }))
              }
            >
              <option value="">Tất cả</option>
              {occasionOptions.map((item) => (
                <option key={item} value={item}>
                  {getOccasionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-full flex justify-end">
            <button
              type="button"
              onClick={clearFiltersKeepSort}
              className="border border-black px-4 py-2 text-[13px] font-bold transition hover:bg-black hover:text-white"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      ) : null}

      {activeFilterChips.length > 0 ? (
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

      {products.length === 0 ? (
        <div className="border border-gray-200 bg-white py-20 text-center">
          <h3 className="mb-2 text-lg font-semibold text-black">Không có sản phẩm phù hợp</h3>
          <p className="text-sm text-gray-500">
            {wishlist.items?.length
              ? "Thử điều chỉnh bộ lọc."
              : "Bạn chưa thêm sản phẩm nào vào yêu thích."}
          </p>
        </div>
      ) : (
        <div className="max-h-[980px] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                isWishlisted
                onAddToWishlist={() => removeWishlistItem(product._id)}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
