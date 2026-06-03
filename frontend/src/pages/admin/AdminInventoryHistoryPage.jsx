import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../lib/api";
import toast from "react-hot-toast";
import AdminPageHeader from "../../components/AdminPageHeader";
import { formatProductName } from "../../lib/productName";
import { History, Download, Package, Filter, Calendar, ChevronsLeft, ChevronsRight } from "lucide-react";

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

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/inventory/transactions/export?${params.toString()}`,
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
    return: "text-green-600 bg-green-50",
  };

  const typeLabels = {
    import: "Nhập hàng",
    export: "Xuất kho",
    adjustment: "Điều chỉnh",
    return: "Hoàn trả",
  };

  const typeIcons = {
    import: "↑",
    export: "↓",
    adjustment: "⟳",
    return: "↩",
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
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Đang xuất..." : "Xuất CSV"}
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[13px] font-bold text-gray-500 mb-2">
              Tìm kiếm
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Sản phẩm, SKU..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-gray-500 mb-2">
              Loại giao dịch
            </label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value });
                setTimeout(loadTransactions, 100);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="import">Nhập hàng</option>
              <option value="export">Xuất kho</option>
              <option value="adjustment">Điều chỉnh</option>
              <option value="return">Hoàn trả</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-gray-500 mb-2">
              Từ ngày
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setTimeout(loadTransactions, 100);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-gray-500 mb-2">
              Đến ngày
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setTimeout(loadTransactions, 100);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
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
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-600">
                  Màu/Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-600">
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
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-600">
                  Lý do
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-600">
                  Người thực hiện
                </th>
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
                            className="w-10 h-10 object-cover rounded-lg"
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
                    <td className="px-4 py-3 text-sm">
                      {tx.variantId?.color} / {tx.variantId?.size}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
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
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="text-gray-500">{tx.previousStock}</span>
                      <span className="mx-2 text-gray-400">→</span>
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
                          <p className="text-blue-600 text-xs mt-1">
                            Đơn hàng: {tx.orderId._id}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {tx.createdBy?.fullname ||
                        tx.createdBy?.username ||
                        "N/A"}
                    </td>
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
        {filteredTransactions.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(
                currentPage * itemsPerPage,
                filteredTransactions.length,
              )}{" "}
              trong tổng số {filteredTransactions.length} giao dịch
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    pages.push(1);

                    if (currentPage > 3) {
                      pages.push("...");
                    }

                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);

                    for (let i = start; i <= end; i++) {
                      if (!pages.includes(i)) {
                        pages.push(i);
                      }
                    }

                    if (currentPage < totalPages - 2) {
                      pages.push("...");
                    }

                    if (!pages.includes(totalPages)) {
                      pages.push(totalPages);
                    }
                  }

                  return pages.map((page, index) => {
                    if (page === "...") {
                      return (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-2 text-gray-400"
                        >
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg transition ${currentPage === page
                          ? "bg-black text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
