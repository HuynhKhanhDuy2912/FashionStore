import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../lib/api";
import toast from "react-hot-toast";
import AdminPageHeader from "../../components/AdminPageHeader";
import { formatProductName } from "../../lib/productName";
import { getPaginationRange } from "../../lib/pagination";
import {
  Package,
  Search,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  History,
  Plus,
  Minus,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export default function AdminInventoryPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("q") || "";
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(globalSearch);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showImportModal, setShowImportModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const [importForm, setImportForm] = useState({
    quantity: "",
    costPrice: "",
    note: "",
  });
  const [adjustForm, setAdjustForm] = useState({
    quantity: "",
    reason: "Kiểm kê",
    note: "",
  });

  useEffect(() => {
    loadData();
    loadCategories();
  }, [token]);

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [inventoryRes, statsRes] = await Promise.all([
        apiRequest("/inventory?limit=10000", { token }),
        apiRequest("/inventory/stats", { token }),
      ]);
      setInventory(inventoryRes.data || []);
      setStats(statsRes);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await apiRequest("/categories", { token });
      setCategories(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

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

  const filteredInventory = useMemo(() => {
    let filtered = [...inventory];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.productId?.name?.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower) ||
          item.color?.toLowerCase().includes(searchLower) ||
          item.size?.toLowerCase().includes(searchLower),
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(
        (item) => item.productId?.categoryId?._id === categoryFilter,
      );
    }

    if (stockFilter === "in-stock") {
      filtered = filtered.filter((item) => (item.stock || 0) > 5);
    } else if (stockFilter === "low-stock") {
      filtered = filtered.filter((item) => (item.stock || 0) > 0 && (item.stock || 0) <= 5);
    } else if (stockFilter === "out-of-stock") {
      filtered = filtered.filter((item) => (item.stock || 0) === 0);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.productId?.name || "").localeCompare(
            b.productId?.name || "",
          );
        case "name-desc":
          return (b.productId?.name || "").localeCompare(
            a.productId?.name || "",
          );
        case "stock-asc":
          return a.stock - b.stock;
        case "stock-desc":
          return b.stock - a.stock;
        case "sku":
          return (a.sku || "").localeCompare(b.sku || "");
        default:
          return 0;
      }
    });

    return filtered;
  }, [inventory, search, categoryFilter, stockFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInventory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInventory, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, stockFilter, sortBy]);

  const handleImport = async (e) => {
    e.preventDefault();
    try {
      await apiRequest("/inventory/import", {
        method: "POST",
        token,
        body: {
          variantId: selectedVariant._id,
          quantity: Number(importForm.quantity),
          costPrice: Number(importForm.costPrice),
          note: importForm.note,
        },
      });
      toast.success("Nhập hàng thành công");
      setShowImportModal(false);
      setImportForm({ quantity: "", costPrice: "", note: "" });
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await apiRequest("/inventory/adjust", {
        method: "POST",
        token,
        body: {
          variantId: selectedVariant._id,
          quantity: Number(adjustForm.quantity),
          reason: adjustForm.reason,
          note: adjustForm.note,
        },
      });
      toast.success("Điều chỉnh tồn kho thành công");
      setShowAdjustModal(false);
      setAdjustForm({ quantity: "", reason: "Kiểm kê", note: "" });
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadHistory = async (variant) => {
    try {
      const res = await apiRequest(`/inventory/${variant._id}`, { token });
      setTransactions(res.transactions || []);
      setSelectedVariant(variant);
      setShowHistoryModal(true);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const getStockStatus = (stock) => {
    if (stock === 0)
      return { label: "Hết hàng", color: "text-red-600 bg-red-100" };
    if (stock <= 5)
      return { label: "Sắp hết", color: "text-orange-500 bg-orange-50" };
    return { label: "Còn hàng", color: "text-green-600 bg-green-50" };
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

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
        title="QUẢN LÝ TỒN KHO"
        description="Quản lý tồn kho sản phẩm theo từng biến thể"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                Tổng sản phẩm
              </p>
              <p className="text-3xl font-bold">{stats?.totalVariants || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                Sắp hết hàng
              </p>
              <p className="text-3xl font-bold text-amber-600">
                {stats?.lowStockCount || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                Hết hàng
              </p>
              <p className="text-3xl font-bold text-red-600">
                {stats?.outOfStockCount || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                Giá trị tồn kho
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats?.totalInventoryValue || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Sản phẩm, SKU, màu, size..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
              Danh mục
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              <option value="">Tất cả danh mục</option>
              {leafCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
              Trạng thái tồn kho
            </label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="in-stock">Còn hàng</option>
              <option value="low-stock">Sắp hết (&le;5)</option>
              <option value="out-of-stock">Hết hàng</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
              Sắp xếp
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              <option value="name-asc">Tên A-Z</option>
              <option value="name-desc">Tên Z-A</option>
              <option value="stock-asc">Tồn kho thấp-cao</option>
              <option value="stock-desc">Tồn kho cao-thấp</option>
              <option value="sku">SKU</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Ảnh
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Sản phẩm
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Màu
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Size
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  SKU
                </th>
                <th className="px-2 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Tồn kho
                </th>
                <th className="px-2 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Giá nhập
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Giá bán
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-600">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedInventory.map((item) => {
                const status = getStockStatus(item.stock);
                const sellingPrice =
                  (item.productId?.price || 0) + (item.priceAdjustment || 0);
                const image = item.image || item.productId?.images?.[0] || "";

                return (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-medium">
                      {formatProductName(item.productId?.name) || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {item.color}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {item.size}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-mono">
                      {item.sku}
                    </td>
                    <td
                      className={`px-4 py-3 text-center text-sm font-bold ${item.stock === 0 ? "text-gray-500" : item.stock <= 5 ? "text-red-600" : "text-green-600"}`}
                    >
                      {item.stock}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {formatCurrency(item.costPrice || 0)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {formatCurrency(sellingPrice)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedVariant(item);
                            setImportForm({
                              quantity: "",
                              costPrice: item.costPrice || "",
                              note: "",
                            });
                            setShowImportModal(true);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Nhập hàng"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVariant(item);
                            setAdjustForm({
                              quantity: "",
                              reason: "Kiểm kê",
                              note: "",
                            });
                            setShowAdjustModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Điều chỉnh"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => loadHistory(item)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title="Lịch sử"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredInventory.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Không tìm thấy sản phẩm nào</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">
              Trang {currentPage} / {totalPages} &mdash; {filteredInventory.length} sản phẩm
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center rounded-lg bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 border border-gray-200 transition"
              >
                <ChevronsLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange(currentPage, totalPages).map((p) => {
                  if (p === "left-ellipsis" || p === "right-ellipsis") {
                    return (
                      <span key={`ellipsis-${p}`} className="px-1 text-gray-400">...</span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${currentPage === p
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
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center rounded-lg bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 border border-gray-200 transition"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && selectedVariant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Nhập hàng</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">
                {formatProductName(selectedVariant.productId?.name)}
              </p>
              <p className="text-sm text-gray-600">
                Màu: {selectedVariant.color} | Size: {selectedVariant.size}
              </p>
              <p className="text-sm text-gray-600">
                Tồn kho hiện tại:{" "}
                <span className="font-bold">{selectedVariant.stock}</span>
              </p>
            </div>

            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">
                  Số lượng nhập *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={importForm.quantity}
                  onChange={(e) =>
                    setImportForm({ ...importForm, quantity: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  Giá nhập *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={importForm.costPrice}
                  onChange={(e) =>
                    setImportForm({ ...importForm, costPrice: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Ghi chú</label>
                <textarea
                  value={importForm.note}
                  onChange={(e) =>
                    setImportForm({ ...importForm, note: e.target.value })
                  }
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                >
                  Nhập hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && selectedVariant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Điều chỉnh tồn kho</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">
                {formatProductName(selectedVariant.productId?.name)}
              </p>
              <p className="text-sm text-gray-600">
                Màu: {selectedVariant.color} | Size: {selectedVariant.size}
              </p>
              <p className="text-sm text-gray-600">
                Tồn kho hiện tại:{" "}
                <span className="font-bold">{selectedVariant.stock}</span>
              </p>
              {adjustForm.quantity && (
                <p className="text-sm text-blue-600 mt-2">
                  Tồn kho mới:{" "}
                  <span className="font-bold">
                    {selectedVariant.stock + Number(adjustForm.quantity)}
                  </span>
                </p>
              )}
            </div>

            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">
                  Số lượng điều chỉnh * (âm để giảm)
                </label>
                <input
                  type="number"
                  required
                  value={adjustForm.quantity}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, quantity: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Lý do *</label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, reason: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="Kiểm kê">Kiểm kê</option>
                  <option value="Hư hỏng">Hư hỏng</option>
                  <option value="Mất mát">Mất mát</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Ghi chú</label>
                <textarea
                  value={adjustForm.note}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, note: e.target.value })
                  }
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                >
                  Điều chỉnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedVariant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold">Lịch sử giao dịch</h3>
              <p className="text-sm text-gray-600 mt-1">
                {formatProductName(selectedVariant.productId?.name)} - {selectedVariant.color} /{" "}
                {selectedVariant.size}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Chưa có giao dịch nào</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const typeColors = {
                      import: "text-green-600 bg-green-50",
                      export: "text-red-600 bg-red-50",
                      adjustment: "text-blue-600 bg-blue-50",
                      return: "text-green-600 bg-green-50",
                    };
                    const typeLabels = {
                      import: "Nhập hàng",
                      export: "Xuất kho",
                      adjustment: "Điều chỉnh",
                      return: "Hoàn trả",
                    };

                    return (
                      <div
                        key={tx._id}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${typeColors[tx.type]}`}
                          >
                            {typeLabels[tx.type]}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(tx.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Số lượng</p>
                            <p
                              className={`font-bold ${tx.quantity > 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {tx.quantity > 0 ? "+" : ""}
                              {tx.quantity}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Tồn trước</p>
                            <p className="font-bold">{tx.previousStock}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Tồn sau</p>
                            <p className="font-bold">{tx.newStock}</p>
                          </div>
                        </div>
                        <div className="mt-2 text-sm">
                          <p className="text-gray-600">
                            <span className="font-medium">Lý do:</span>{" "}
                            {tx.reason}
                          </p>
                          {tx.note && (
                            <p className="text-gray-600">
                              <span className="font-medium">Ghi chú:</span>{" "}
                              {tx.note}
                            </p>
                          )}
                          <p className="text-gray-600">
                            <span className="font-medium">
                              Người thực hiện:
                            </span>{" "}
                            {tx.createdBy?.fullname ||
                              tx.createdBy?.username ||
                              "N/A"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
