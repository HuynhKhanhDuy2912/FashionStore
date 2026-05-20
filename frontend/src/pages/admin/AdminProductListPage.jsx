import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import { sortVariantsBySize } from "../../lib/sizes.js";
import {
  Plus,
  Search,
  Filter,
  X,
  Package,
  TrendingUp,
  Tag,
  Grid3x3,
  SlidersHorizontal,
  ChevronDown,
  Edit2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import toast from "react-hot-toast";

export default function AdminProductListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [discountFilter, setDiscountFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadProducts = async () => {
    try {
      const [prodRes, varRes, catRes] = await Promise.all([
        apiRequest("/products?limit=1000", { token }),
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
    }
  };

  useEffect(() => {
    loadProducts();
  }, [token]);

  const handleDelete = async (product) => {
    try {
      await apiRequest(`/products/${product._id}`, { method: "DELETE", token });
      toast.success(`Đã xóa sản phẩm "${product.name}"`);
      setDeleteConfirm(null);
      loadProducts();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const styles = useMemo(() => {
    const styleSet = new Set(products.map((p) => p.style).filter(Boolean));
    return Array.from(styleSet).sort();
  }, [products]);

  const filteredAndSorted = useMemo(() => {
    let result = products.filter((p) => {
      const searchMatch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.categoryId?.name || "").toLowerCase().includes(search.toLowerCase());

      const categoryMatch =
        categoryFilter === "all" || p.categoryId?._id === categoryFilter;
      const styleMatch = styleFilter === "all" || p.style === styleFilter;
      const discountMatch =
        discountFilter === "all" ||
        (discountFilter === "yes" && p.discount > 0) ||
        (discountFilter === "no" && (!p.discount || p.discount === 0));

      const totalStock = (p.variants || []).reduce(
        (sum, v) => sum + (v.stock || 0),
        0,
      );
      const stockMatch =
        stockFilter === "all" ||
        (stockFilter === "in" && totalStock > 0) ||
        (stockFilter === "out" && totalStock === 0);

      return (
        searchMatch &&
        categoryMatch &&
        styleMatch &&
        discountMatch &&
        stockMatch
      );
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
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
    discountFilter,
    stockFilter,
    sortBy,
  ]);

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
    if (discountFilter !== "all") count++;
    if (stockFilter !== "all") count++;
    return count;
  }, [search, categoryFilter, styleFilter, discountFilter, stockFilter]);

  const clearAllFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStyleFilter("all");
    setDiscountFilter("all");
    setStockFilter("all");
  };

  const inputClass =
    "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600";
  const selectClass =
    "rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600";

  return (
    <section className="grid gap-6 p-6">
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
            color: "bg-blue-50 text-blue-600 border-blue-100",
          },
          {
            label: "Tổng biến thể",
            value: stats.totalVariants,
            icon: Grid3x3,
            color: "bg-purple-50 text-purple-600 border-purple-100",
          },
          {
            label: "Có giảm giá",
            value: stats.withDiscount,
            icon: Tag,
            color: "bg-orange-50 text-orange-600 border-orange-100",
          },
          {
            label: "Tồn kho",
            value: stats.totalStock,
            icon: TrendingUp,
            color: "bg-green-50 text-green-600 border-green-100",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className={`flex items-center gap-4 rounded-2xl border p-5 bg-white shadow-sm ${color.split(" ")[2]}`}
          >
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${color.split(" ")[0]} ${color.split(" ")[1]}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, danh mục, thương hiệu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600"
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
            className={`flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-semibold transition ${
              showFilters
                ? "border-blue-600 bg-blue-50 text-blue-600"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal size={16} />
            Bộ lọc
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-blue-600"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="name-asc">Tên A-Z</option>
            <option value="name-desc">Tên Z-A</option>
            <option value="price-asc">Giá thấp → cao</option>
            <option value="price-desc">Giá cao → thấp</option>
            <option value="variants">Nhiều biến thể nhất</option>
          </select>

          <button
            onClick={() => navigate("/admin/products/add")}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-blue-700"
          >
            <Plus size={16} />
            Thêm sản phẩm
          </button>
        </div>

        {showFilters && (
          <div className="mb-4 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                Danh mục
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Tất cả danh mục</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
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
                    {style}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
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
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                Tồn kho
              </label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">Tất cả</option>
                <option value="in">Còn hàng</option>
                <option value="out">Hết hàng</option>
              </select>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex items-end md:col-span-2 lg:col-span-4">
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <X size={16} />
                  Xóa tất cả bộ lọc ({activeFiltersCount})
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-3">
          <p className="text-sm text-gray-600">
            Hiển thị{" "}
            <span className="font-bold text-gray-900">
              {filteredAndSorted.length}
            </span>{" "}
            / {products.length} sản phẩm
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-[80px_1fr_200px_140px_120px_100px_140px] gap-4 rounded-t-lg border-b-2 border-gray-300 bg-gray-100 px-5 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Ảnh
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Sản phẩm
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Biến thể
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Danh mục
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Giá
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Giảm giá
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Thao tác
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredAndSorted.length === 0 ? (
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
                filteredAndSorted.map((product) => {
                  const totalStock = (product.variants || []).reduce(
                    (sum, v) => sum + (v.stock || 0),
                    0,
                  );
                  const isOutOfStock = totalStock === 0;

                  return (
                    <div
                      key={product._id}
                      className="grid grid-cols-[80px_1fr_200px_140px_120px_100px_140px] gap-4 px-5 py-4 transition hover:bg-gray-50"
                    >
                      <div className="relative h-16 w-16 overflow-hidden rounded border border-gray-200 bg-gray-100">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            className="h-full w-full object-cover"
                            alt={product.name}
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
                        <strong className="mb-1 line-clamp-1 text-sm text-gray-900">
                          {product.name}
                        </strong>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                            {product.style || "N/A"}
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
                                    {sortedVariants.map((v, idx) => (
                                      <span key={idx}>
                                        {v.size}({v.stock || 0})
                                        {idx < sortedVariants.length - 1
                                          ? ", "
                                          : ""}
                                      </span>
                                    ))}
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

                      <div className="flex items-center">
                        <span className="truncate text-xs font-medium text-gray-700">
                          {product.categoryId?.name || "—"}
                        </span>
                      </div>

                      <div className="flex flex-col justify-center">
                        <span className="text-sm font-bold text-gray-900">
                          {Number(product.price).toLocaleString("vi-VN")}₫
                        </span>
                        {product.discount > 0 && (
                          <span className="text-xs font-semibold text-green-600">
                            Sau giảm:{" "}
                            {Math.round(
                              product.price * (1 - product.discount / 100),
                            ).toLocaleString("vi-VN")}
                            ₫
                          </span>
                        )}
                      </div>

                      <div className="flex items-center">
                        {product.discount > 0 ? (
                          <span className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600">
                            -{product.discount}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
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
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
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
                {deleteConfirm.name}
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
