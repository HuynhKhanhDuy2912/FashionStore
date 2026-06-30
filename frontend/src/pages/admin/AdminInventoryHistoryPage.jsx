import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../lib/api";
import toast from "react-hot-toast";
import AdminPageHeader from "../../components/AdminPageHeader";
import { formatProductName } from "../../lib/productName";
import { getPaginationRange } from "../../lib/pagination";
import {
  History, Download, Package, Search, Calendar, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowRight, RefreshCw, Undo2
} from "lucide-react";

export default function AdminInventoryHistoryPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [filters, setFilters] = useState({
    search: "",
    type: "",
    startDate: "",
    endDate: "",
  });

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState("all");
  const [exportDates, setExportDates] = useState({ startDate: "", endDate: "" });

  useEffect(() => {
    loadTransactions();
  }, [token]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      params.append("limit", "100");

      const res = await apiRequest(
        `/inventory/transactions?${params.toString()}`,
        { token },
      );
      setTransactions(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);

      const now = new Date();
      let start = "";
      let end = "";

      if (exportRange === "thisMonth") {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      } else if (exportRange === "lastMonth") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
        end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
      } else if (exportRange === "custom") {
        start = exportDates.startDate;
        end = exportDates.endDate;
      }

      if (start) params.append("startDate", start);
      if (end) params.append("endDate", end);

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"}/inventory/transactions/export?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-history-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Xuất file thành công");
      setShowExportModal(false);
    } catch (e) {
      toast.error("Không thể xuất file");
    } finally {
      setExporting(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      tx.productId?.name?.toLowerCase().includes(searchLower) ||
      tx.variantId?.sku?.toLowerCase().includes(searchLower) ||
      tx.variantId?.color?.toLowerCase().includes(searchLower) ||
      tx.variantId?.size?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.type, filters.startDate, filters.endDate]);

  const typeColors = {
    import: "text-green-600 bg-green-50",
    export: "text-red-600 bg-red-50",
    adjustment: "text-blue-600 bg-blue-50",
    return: "text-orange-600 bg-orange-50",
  };

  const typeLabels = {
    import: "Nhập hàng",
    export: "Xuất kho",
    adjustment: "Điều chỉnh",
    return: "Hoàn trả",
  };

  const typeIcons = {
    import: <ArrowUp size={16} />,
    export: <ArrowDown size={16} />,
    adjustment: <RefreshCw size={16} />,
    return: <Undo2 size={16} />,
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
        title="QUẢN LÝ LỊCH SỬ NHẬP XUẤT"
        description="Xem lịch sử nhập xuất và điều chỉnh tồn kho"
        aside={
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            <Download className="w-4 h-4" />
            Xuất CSV
          </button>
        }
      />

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
                placeholder="Sản phẩm, SKU..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
              Loại giao dịch
            </label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value });
                setTimeout(loadTransactions, 100);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="import">Nhập hàng</option>
              <option value="export">Xuất kho</option>
              <option value="adjustment">Điều chỉnh</option>
              <option value="return">Hoàn trả</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
              Từ ngày
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setTimeout(loadTransactions, 100);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">
              Đến ngày
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setTimeout(loadTransactions, 100);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-600">
                  Thời gian
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-600">
                  Sản phẩm
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
                  Màu/Size
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
                  SKU
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
                  Loại
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
                  Số lượng
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
                  Tồn kho
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-600 min-w-[150px]">
                  Lý do
                </th>
                {/* <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-600">
                  Người thực hiện
                </th> */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedTransactions.map((tx) => {
                const image =
                  tx.variantId?.image || tx.productId?.images?.[0] || "";

                return (
                  <tr key={tx._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(tx.createdAt).toLocaleString("vi-VN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            className="w-10 h-10 object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          {formatProductName(tx.productId?.name) || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      {tx.variantId?.color} / {tx.variantId?.size}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      {tx.variantId?.sku || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${typeColors[tx.type]}`}
                      >
                        <span>{typeIcons[tx.type]}</span>
                        {typeLabels[tx.type]}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-center text-sm font-bold ${tx.quantity > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {tx.quantity > 0 ? "+" : ""}
                      {tx.quantity}
                    </td>
                    <td className="px-4 py-3 text-center text-sm min-w-[80px]">
                      <span className="text-gray-500">{tx.previousStock}</span>
                      <ArrowRight className="mx-2 text-gray-400 w-3 h-3 inline" />
                      <span className="font-bold">{tx.newStock}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium">{tx.reason}</p>
                        {tx.note && (
                          <p className="text-gray-500 text-xs mt-1">
                            {tx.note}
                          </p>
                        )}
                        {tx.orderId && (
                          <p className="text-blue-600 text-xs mt-1 min-w-[150px]">
                            Đơn hàng: {tx.orderId._id.slice(-8).toUpperCase()}
                          </p>
                        )}
                      </div>
                    </td>
                    {/* <td className="px-4 py-3 text-sm">
                      {tx.createdBy?.fullname ||
                        tx.createdBy?.username ||
                        "N/A"}
                    </td> */}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Không có giao dịch nào</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">
              Trang {currentPage} / {totalPages} &mdash; {filteredTransactions.length} giao dịch
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

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Tùy chọn xuất file CSV</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Thời gian xuất dữ liệu
                </label>
                <select
                  value={exportRange}
                  onChange={(e) => setExportRange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
                >
                  <option value="all">Toàn bộ dữ liệu</option>
                  <option value="thisMonth">Tháng này</option>
                  <option value="lastMonth">Tháng trước</option>
                  <option value="custom">Tùy chỉnh khoảng thời gian</option>
                </select>
              </div>

              {exportRange === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Từ ngày</label>
                    <input
                      type="date"
                      value={exportDates.startDate}
                      onChange={(e) => setExportDates({ ...exportDates, startDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Đến ngày</label>
                    <input
                      type="date"
                      value={exportDates.endDate}
                      onChange={(e) => setExportDates({ ...exportDates, endDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={confirmExport}
                disabled={exporting || (exportRange === "custom" && (!exportDates.startDate || !exportDates.endDate))}
                className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Đang xử lý...
                  </>
                ) : (
                  "Xác nhận xuất"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
