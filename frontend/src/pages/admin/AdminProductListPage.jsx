import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import { sortVariantsBySize } from "../../lib/sizes.js";
import { formatProductName } from "../../lib/productName.js";
import { getPaginationRange } from "../../lib/pagination.js";
import {
  X,
  Tag,
  Eye,
  Plus,
  Edit2,
  Trash2,
  Search,
  EyeOff,
  Grid3x3,
  Package,
  TrendingUp,
  ChevronsLeft,
  ChevronsRight,
  TriangleAlert,

  SlidersHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";

const styleLabels = {
  casual: "Thường ngày (Casual)",
  minimal: "Tối giản (Minimal)",
  streetwear: "Đường phố (Streetwear)",
  elegant: "Thanh lịch (Elegant)",
  sporty: "Thể thao (Sporty)",
  vintage: "Cổ điển (Vintage)",
  smart_casual: "Công sở năng động (Smart Casual)",
};

// Giá bán thực tế = giá gốc + điều chỉnh của từng biến thể (priceAdjustment).
// Trả về khoảng giá thấp nhất / cao nhất trên các biến thể.
function getEffectivePriceRange(product) {
  const base = Number(product.price || 0);
  const variants = product.variants || [];
  if (variants.length === 0) return { min: base, max: base };
  const prices = variants.map((v) => base + Number(v.priceAdjustment || 0));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function formatVnd(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("vi-VN")}₫`;
}

export default function AdminProductListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("q") || "";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(globalSearch);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [discountFilter, setDiscountFilter] = useState("all");
  const [deletedFilter, setDeletedFilter] = useState("active");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const loadProducts = async () => {
    try {
      setLoading(true);
      const [prodRes, varRes, catRes] = await Promise.all([
        apiRequest("/products?limit=1000&isDeleted=all", { token }),
        apiRequest("/product-variants?limit=5000", { token }),
        apiRequest("/categories?limit=1000", { token }),
      ]);
      const allVariants = varRes.data || [];
      const productsWithVariants = (prodRes.data || []).map((p) => ({
        ...p,
        variants: allVariants.filter(
          (v) => v.productId === p._id || v.productId?._id === p._id,
        ),
      }));
      setProducts(productsWithVariants);
      setCategories(catRes.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [token]);

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  useEffect(() => {
    const handleProductsChanged = () => {
      loadProducts();
    };
    window.addEventListener("products:changed", handleProductsChanged);
    return () => window.removeEventListener("products:changed", handleProductsChanged);
  }, [token]);

  const handleDelete = async (product) => {
    try {
      await apiRequest(`/products/${product._id}`, { method: "DELETE", token });
      toast.success(`Đã xóa sản phẩm "${formatProductName(product.name)}" thành công!`);
      setDeleteConfirm(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggleActive = async (product) => {
    try {
      await apiRequest(`/products/${product._id}`, {
        method: "PUT",
        token,
        body: { isActive: !product.isActive },
      });
      setProducts((prev) =>
        prev.map((p) =>
          p._id === product._id ? { ...p, isActive: !product.isActive } : p
        )
      );
      toast.success(
        `Đã ${product.isActive ? "ẩn" : "hiển thị"} sản phẩm "${formatProductName(product.name)}"`
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  const styles = useMemo(() => {
    const styleSet = new Set();
    products.forEach((p) => {
      if (Array.isArray(p.style)) {
        p.style.forEach((s) => s && styleSet.add(s));
      } else if (p.style) {
        styleSet.add(p.style);
      }
    });
    return Array.from(styleSet).sort();
  }, [products]);

  // Chỉ lấy danh mục cấp 3 (lá): danh mục có cha, và cha đó cũng có cha.
  const leafCategories = useMemo(() => {
    const getParentId = (cat) => cat?.parentId?._id || cat?.parentId || null;
    const catById = new Map(categories.map((cat) => [cat._id, cat]));
    return categories.filter((cat) => {
      const parentId = getParentId(cat);
      if (!parentId) return false; // cấp 1
      const parent = catById.get(parentId);
      return Boolean(parent && getParentId(parent)); // cha có cha => cấp 3
    });
  }, [categories]);

  const filteredAndSorted = useMemo(() => {
    let result = products.filter((p) => {
      const searchMatch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.categoryId?.name || "").toLowerCase().includes(search.toLowerCase());

      const categoryMatch =
        categoryFilter === "all" || p.categoryId?._id === categoryFilter;
      const styleMatch =
        styleFilter === "all" ||
        (Array.isArray(p.style)
          ? p.style.includes(styleFilter)
          : p.style === styleFilter);
      const genderMatch = genderFilter === "all" || p.gender === genderFilter;
      const discountMatch =
        discountFilter === "all" ||
        (discountFilter === "yes" && p.discount > 0) ||
        (discountFilter === "no" && (!p.discount || p.discount === 0));
      const deletedMatch =
        deletedFilter === "all" ||
        (deletedFilter === "active" && !p.isDeleted) ||
        (deletedFilter === "deleted" && p.isDeleted);

      return (
        searchMatch &&
        categoryMatch &&
        styleMatch &&
        genderMatch &&
        discountMatch &&
        deletedMatch
      );
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return getEffectivePriceRange(a).min - getEffectivePriceRange(b).min;
        case "price-desc":
          return getEffectivePriceRange(b).min - getEffectivePriceRange(a).min;
        case "newest":
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case "oldest":
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case "variants":
          return (b.variants?.length || 0) - (a.variants?.length || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [
    products,
    search,
    categoryFilter,
    styleFilter,
    genderFilter,
    discountFilter,
    deletedFilter,
    sortBy,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, styleFilter, genderFilter, discountFilter, deletedFilter, sortBy]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSorted.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSorted, currentPage]);

  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);

  const stats = useMemo(() => {
    const totalVariants = products.reduce(
      (sum, p) => sum + (p.variants?.length || 0),
      0,
    );
    const withDiscount = products.filter((p) => p.discount > 0).length;
    const totalStock = products.reduce(
      (sum, p) =>
        sum + (p.variants || []).reduce((s, v) => s + (v.stock || 0), 0),
      0,
    );
    return { totalVariants, withDiscount, totalStock };
  }, [products]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (categoryFilter !== "all") count++;
    if (styleFilter !== "all") count++;
    if (genderFilter !== "all") count++;
    if (discountFilter !== "all") count++;
    if (deletedFilter !== "active") count++;
    return count;
  }, [search, categoryFilter, styleFilter, genderFilter, discountFilter, deletedFilter]);

  const clearAllFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStyleFilter("all");
    setGenderFilter("all");
    setDiscountFilter("all");
    setDeletedFilter("active");
  };

  const inputClass =
    "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600";
  const selectClass =
    "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="grid gap-4 p-6">
      <AdminPageHeader
        title="DANH SÁCH SẢN PHẨM"
        description="Quản lý toàn bộ sản phẩm trong hệ thống"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Tổng sản phẩm",
            value: products.length,
            icon: Package,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-600",
          },
          {
            label: "Tổng biến thể",
            value: stats.totalVariants,
            icon: Grid3x3,
            iconBg: "bg-purple-50",
            iconColor: "text-purple-600",
          },
          {
            label: "Có giảm giá",
            value: stats.withDiscount,
            icon: Tag,
            iconBg: "bg-orange-50",
            iconColor: "text-orange-600",
            valueClass: "text-orange-600",
          },
          {
            label: "Tồn kho",
            value: stats.totalStock,
            icon: TrendingUp,
            iconBg: "bg-green-50",
            iconColor: "text-green-600",
            valueClass: "text-green-600",
          },
        ].map(({ label, value, icon: Icon, iconBg, iconColor, valueClass }) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-500">
                  {label}
                </p>
                <p
                  className={`text-3xl font-bold ${valueClass || "text-gray-900"}`}
                >
                  {value}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}
              >
                <Icon className={`h-6 w-6 ${iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[300px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, danh mục,..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-black"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${showFilters
              ? "border-black bg-gray-100 text-black"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
          >
            <SlidersHorizontal size={16} />
            Bộ lọc
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-black"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="name-asc">Tên A-Z</option>
            <option value="name-desc">Tên Z-A</option>
            <option value="price-asc">Giá từ thấp &rarr; cao</option>
            <option value="price-desc">Giá từ cao &rarr; thấp</option>
            <option value="variants">Nhiều biến thể nhất</option>
          </select>

          <button
            onClick={() => navigate("/admin/products/add")}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider text-white transition hover:bg-gray-800"
          >
            <Plus size={16} />
            Thêm sản phẩm
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
                Danh mục
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Tất cả danh mục</option>
                {leafCategories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
                Phong cách
              </label>
              <select
                value={styleFilter}
                onChange={(e) => setStyleFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Tất cả phong cách</option>
                {styles.map((style) => (
                  <option key={style} value={style}>
                    {styleLabels[style] || style}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
                Giới tính
              </label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Tất cả</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
                Giảm giá
              </label>
              <select
                value={discountFilter}
                onChange={(e) => setDiscountFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Tất cả</option>
                <option value="yes">Có giảm giá</option>
                <option value="no">Không giảm giá</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
                Trạng thái
              </label>
              <select
                value={deletedFilter}
                onChange={(e) => setDeletedFilter(e.target.value)}
                className={selectClass}
              >
                <option value="active">Đang bán</option>
                <option value="deleted">Đã ngừng kinh doanh</option>
                <option value="all">Tất cả</option>
              </select>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex items-end md:col-span-2 lg:col-span-3">
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <X size={16} />
                  Xóa tất cả bộ lọc ({activeFiltersCount})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <p className="text-sm text-gray-600">
            Hiển thị{" "}
            <span className="font-bold text-gray-900">
              {paginatedProducts.length}
            </span>{" "}
            / {filteredAndSorted.length} sản phẩm
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-[80px_1fr_200px_140px_120px_100px_200px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Ảnh
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Sản phẩm
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Biến thể
              </span>
              <span className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Danh mục
              </span>
              <span className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Giá bán
              </span>
              <span className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Giảm giá
              </span>
              <span className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Thao tác
              </span>
            </div>

            <div className="divide-y divide-gray-200">
              {paginatedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Package size={48} className="mb-3 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">
                    {search || activeFiltersCount > 0
                      ? "Không tìm thấy sản phẩm phù hợp"
                      : "Chưa có sản phẩm nào"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {activeFiltersCount > 0
                      ? "Thử điều chỉnh bộ lọc"
                      : "Thêm sản phẩm mới để bắt đầu"}
                  </p>
                </div>
              ) : (
                paginatedProducts.map((product) => {
                  const totalStock = (product.variants || []).reduce(
                    (sum, v) => sum + (v.stock || 0),
                    0,
                  );
                  const isOutOfStock = totalStock === 0;
                  const displayName = formatProductName(product.name);
                  const maxDiscount = Math.max(
                    product.discount || 0,
                    ...(product.variants || []).map(v => (v.discount != null ? v.discount : (product.discount || 0)))
                  );
                  const priceRange = getEffectivePriceRange(product);

                  return (
                    <div
                      key={product._id}
                      className={`grid items-center grid-cols-[80px_1fr_200px_140px_120px_100px_200px] gap-4 px-5 py-4 transition hover:bg-gray-50 ${product.isDeleted ? "bg-red-50/30 opacity-75 grayscale" : !product.isActive ? "bg-gray-50/50" : ""}`}
                    >
                      <div className={`relative h-16 w-16 overflow-hidden rounded border border-gray-200 bg-gray-100 ${!product.isActive ? "opacity-50 grayscale" : ""}`}>
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            className="h-full w-full object-cover"
                            alt={displayName}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-gray-300">
                            N/A
                          </div>
                        )}
                        {isOutOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                              Hết hàng
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-center">
                        <strong className="mb-1 line-clamp-1 text-sm text-gray-900 flex items-center flex-wrap gap-2">
                          {displayName}
                          {product.isDeleted && (
                            <span className="rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700">ĐÃ XÓA</span>
                          )}
                          {!product.isActive && !product.isDeleted && (
                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">ĐÃ ẨN</span>
                          )}
                        </strong>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                            {Array.isArray(product.style) ? product.style.join(", ") : (product.style || "N/A")}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${product.gender === "female"
                              ? "bg-pink-50 text-pink-600"
                              : "bg-blue-50 text-blue-600"
                              }`}
                          >
                            {product.gender === "female" ? "Nữ" : "Nam"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center gap-1 text-[11px]">
                        <span className="font-semibold text-gray-900">
                          {product.variants?.length || 0} biến thể
                        </span>
                        <div className="text-gray-500 space-y-0.5">
                          {(() => {
                            const variantsByColor = {};
                            (product.variants || []).forEach((v) => {
                              if (!variantsByColor[v.color]) {
                                variantsByColor[v.color] = [];
                              }
                              variantsByColor[v.color].push(v);
                            });
                            return Object.entries(variantsByColor).map(
                              ([color, variants]) => {
                                const sortedVariants =
                                  sortVariantsBySize(variants);
                                return (
                                  <div key={color}>
                                    <span className="font-medium">
                                      {color}:
                                    </span>{" "}
                                    {sortedVariants.map((v, idx) => {
                                      const isVariantOutOfStock = (v.stock || 0) === 0;
                                      return (
                                        <span key={idx}>
                                          <span className={isVariantOutOfStock ? "text-red-600 font-bold" : ""}>
                                            {v.size}({v.stock || 0})
                                          </span>
                                          {idx < sortedVariants.length - 1 ? ", " : ""}
                                        </span>
                                      );
                                    })}
                                  </div>
                                );
                              },
                            );
                          })()}
                        </div>
                        <span
                          className={`font-semibold ${isOutOfStock ? "text-red-600" : "text-green-600"}`}
                        >
                          Tổng tồn: {totalStock}
                        </span>
                      </div>

                      <div className="flex items-center justify-center">
                        <span className="truncate text-xs font-medium text-gray-700">
                          {product.categoryId?.name || "—"}
                        </span>
                      </div>

                      <div className="flex flex-col justify-center text-center">
                        <span className="text-sm font-bold text-gray-900">
                          {priceRange.min === priceRange.max
                            ? formatVnd(priceRange.min)
                            : `${formatVnd(priceRange.min)} - ${formatVnd(priceRange.max)}`}
                        </span>
                        {maxDiscount > 0 && (
                          <span className="text-xs font-semibold text-green-600">
                            Sau giảm:{" "}
                            {priceRange.min === priceRange.max
                              ? formatVnd(priceRange.min * (1 - maxDiscount / 100))
                              : `${formatVnd(priceRange.min * (1 - maxDiscount / 100))} - ${formatVnd(priceRange.max * (1 - maxDiscount / 100))}`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-center">
                        {maxDiscount > 0 ? (
                          <span className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600">
                            {maxDiscount !== (product.discount || 0) ? `${maxDiscount}%` : `-${maxDiscount}%`}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!product.isDeleted && (
                          <>
                            <button
                              title={product.isActive ? "Ẩn sản phẩm" : "Hiện sản phẩm"}
                              className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold text-white transition ${product.isActive
                                ? "bg-gray-500 border-gray-500 hover:bg-gray-600"
                                : "bg-green-600 border-green-600 hover:bg-green-700"
                                }`}
                              onClick={() => handleToggleActive(product)}
                            >
                              {product.isActive ? (
                                <><EyeOff size={12} /> Ẩn</>
                              ) : (
                                <><Eye size={12} /> Hiện</>
                              )}
                            </button>
                            <button
                              className="flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                              onClick={() =>
                                navigate(`/admin/products/add?id=${product._id}`)
                              }
                            >
                              <Edit2 size={12} />
                              Sửa
                            </button>
                            <button
                              className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                              onClick={() => setDeleteConfirm(product)}
                            >
                              <Trash2 size={12} />
                              Xóa
                            </button>
                          </>
                        )}
                        {product.isDeleted && (
                          <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded border border-red-200">
                            Không thể thao tác
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">
              Trang {currentPage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange(currentPage, totalPages).map((page) => {
                  if (page === "left-ellipsis" || page === "right-ellipsis") {
                    return (
                      <span key={`ellipsis-${page}`} className="px-1 text-gray-400">...</span>
                    );
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 rounded text-sm font-medium ${currentPage === page
                        ? "bg-black text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-3">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Xác nhận xóa sản phẩm
                </h3>
                <p className="text-sm text-gray-600">
                  Hành động này không thể hoàn tác
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                Sản phẩm sẽ bị xóa
              </p>

              <p className="text-sm font-semibold text-gray-900">
                {formatProductName(deleteConfirm.name)}
              </p>

              {deleteConfirm.variants && deleteConfirm.variants.length > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-red-600">
                  <TriangleAlert className="h-4 w-4 shrink-0" />

                  <span className="text-xs font-medium">
                    Có {deleteConfirm.variants.length} biến thể sẽ bị xóa theo
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-red-700"
              >
                <Trash2 size={14} />
                Xóa ngay
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded border border-gray-300 bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
