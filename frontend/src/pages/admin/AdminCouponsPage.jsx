import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Plus, Search, Tag, Trash2, ToggleLeft, ToggleRight, Pencil, Truck, BadgePercent, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { apiRequest } from "../../lib/api.js";
import { getPaginationRange } from "../../lib/pagination.js";

const formatCurrency = (v = 0) => `${Number(v).toLocaleString("vi-VN")}đ`;
const formatDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN") : "");

const PAGE_SIZE = 10;

const TYPE_LABELS = {
  percentage: "Giảm %",
  fixed_amount: "Giảm tiền",
  free_shipping: "Free ship"
};

const TYPE_COLORS = {
  percentage: "bg-blue-50 text-blue-700 border-blue-200",
  fixed_amount: "bg-green-50 text-green-700 border-green-200",
  free_shipping: "bg-purple-50 text-purple-700 border-purple-200"
};

const TYPE_ICON = {
  percentage: <BadgePercent className="h-4 w-4" />,
  fixed_amount: <Tag className="h-4 w-4" />,
  free_shipping: <Truck className="h-4 w-4" />
};

const getStatusBadge = (coupon) => {
  const now = new Date();
  if (!coupon.isActive) return { label: "Không hoạt động", cls: "bg-gray-300 text-black border-gray-200 rounded-full px-2 py-1" };
  if (new Date(coupon.startDate) > now) return { label: "Chưa bắt đầu", cls: "bg-yellow-50 text-yellow-700 border-yellow-200 rounded-full px-2 py-1" };
  if (new Date(coupon.endDate) < now) return { label: "Hết hạn", cls: "bg-red-50 text-red-700 border-red-200 rounded-full px-2 py-1" };
  if (coupon.maxUsage !== null && coupon.currentUsage >= coupon.maxUsage) return { label: "Hết lượt", cls: "bg-orange-50 text-orange-700 border-orange-200 rounded-full px-2 py-1" };
  return { label: "Hoạt động", cls: "bg-green-50 text-green-700 border-green-200 rounded-full px-2 py-1" };
};

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  maxDiscountAmount: "",
  minOrderAmount: "",
  startDate: "",
  endDate: "",
  maxUsage: "",
  maxUsagePerUser: 1,
  isFirstOrderOnly: false,
  isActive: true
};

export default function AdminCouponsPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("q") || "";
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(globalSearch);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadCoupons();
  }, [filterType, filterStatus]);

  useEffect(() => {
    setSearchTerm(globalSearch);
  }, [globalSearch]);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterType) params.set("discountType", filterType);
      if (filterStatus) params.set("status", filterStatus);

      const res = await apiRequest(`/coupons/admin/all?${params}`, { token });
      setCoupons(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCoupons = coupons.filter((c) =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedCoupons = filteredCoupons.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterType, filterStatus]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || "",
      description: coupon.description || "",
      discountType: coupon.discountType || "percentage",
      discountValue: coupon.discountValue || "",
      maxDiscountAmount: coupon.maxDiscountAmount || "",
      minOrderAmount: coupon.minOrderAmount || "",
      startDate: coupon.startDate ? coupon.startDate.split("T")[0] : "",
      endDate: coupon.endDate ? coupon.endDate.split("T")[0] : "",
      maxUsage: coupon.maxUsage ?? "",
      maxUsagePerUser: coupon.maxUsagePerUser || 1,
      isFirstOrderOnly: coupon.isFirstOrderOnly || false,
      isActive: coupon.isActive !== false
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      const body = {
        ...formData,
        discountValue: Number(formData.discountValue),
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        maxUsage: formData.maxUsage !== "" ? Number(formData.maxUsage) : null,
        maxUsagePerUser: Number(formData.maxUsagePerUser) || 1,
      };

      if (editingCoupon) {
        await apiRequest(`/coupons/admin/${editingCoupon._id}`, {
          method: "PUT",
          token,
          body
        });
      } else {
        await apiRequest("/coupons/admin", {
          method: "POST",
          token,
          body
        });
      }

      setShowModal(false);
      loadCoupons();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await apiRequest(`/coupons/admin/${id}/toggle`, {
        method: "PATCH",
        token
      });
      loadCoupons();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc muốn xóa mã giảm giá này?")) return;
    try {
      await apiRequest(`/coupons/admin/${id}`, {
        method: "DELETE",
        token
      });
      loadCoupons();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="grid gap-4 p-6">
      <AdminPageHeader
        title="QUẢN LÝ MÃ GIẢM GIÁ"
        description="Quản lý coupon và voucher."
        aside={
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-gray-800 cursor-pointer border-none rounded-md"
          >
            <Plus size={16} /> Thêm mã mới
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm mã giảm giá..."
            className="w-full border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-black rounded-md"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black rounded-md"
        >
          <option value="">Tất cả loại</option>
          <option value="percentage">Giảm %</option>
          <option value="fixed_amount">Giảm tiền</option>
          <option value="free_shipping">Free ship</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black rounded-md"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="expired">Hết hạn</option>
          <option value="upcoming">Chưa bắt đầu</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            Không có mã giảm giá nào
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Mã</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Giá trị</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Đơn tối thiểu</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Thời hạn</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Đã dùng</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Trạng thái</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCoupons.map((coupon) => {
                const status = getStatusBadge(coupon);
                return (
                  <tr key={coupon._id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-bold uppercase">{coupon.code}</div>
                      {coupon.description && (
                        <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">{coupon.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[coupon.discountType]}`}>
                        {TYPE_ICON[coupon.discountType]}
                        {TYPE_LABELS[coupon.discountType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {coupon.discountType === "percentage"
                        ? `${coupon.discountValue}%`
                        : coupon.discountType === "fixed_amount"
                          ? formatCurrency(coupon.discountValue)
                          : coupon.discountValue > 0 ? formatCurrency(coupon.discountValue) : "Toàn bộ phí"}
                      {coupon.maxDiscountAmount > 0 && (
                        <div className="text-xs text-gray-500">Max: {formatCurrency(coupon.maxDiscountAmount)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {coupon.minOrderAmount > 0
                        ? formatCurrency(coupon.minOrderAmount)
                        : "Không"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatDate(coupon.startDate)} - {formatDate(coupon.endDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium">{coupon.currentUsage}</span>
                      <span className="text-gray-400">
                        /{coupon.maxUsage ?? "∞"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block border px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title={coupon.isActive ? "Tắt" : "Bật"}
                          onClick={() => handleToggle(coupon._id)}
                          className={`items-center gap-1.5 rounded border px-3 py-1 text-xs font-semibold text-white transition ${coupon.isActive
                            ? "border-green-600 bg-green-600 hover:bg-green-700"
                            : "border-gray-500 bg-gray-500 hover:bg-gray-600"
                            }`}
                        >
                          {coupon.isActive ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Sửa"
                          onClick={() => openEditModal(coupon)}
                          className="items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Xóa"
                          onClick={() => handleDelete(coupon._id)}
                          className="items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <span className="text-sm text-gray-500">
            Trang {currentPage} / {totalPages} &mdash; {filteredCoupons.length} mã giảm giá
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 rounded text-sm font-medium ${currentPage === p
                      ? "bg-black text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100"
                      }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold uppercase">
                {editingCoupon ? "Sửa mã giảm giá" : "Tạo mã giảm giá mới"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Mã giảm giá *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: THANG6"
                    required
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Loại giảm giá *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  >
                    <option value="percentage">Giảm theo %</option>
                    <option value="fixed_amount">Giảm số tiền cố định</option>
                    <option value="free_shipping">Miễn phí vận chuyển</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Mô tả</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả ngắn về mã giảm giá"
                  className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {formData.discountType === "percentage" ? "Phần trăm giảm (%)" : "Số tiền giảm (đ)"}
                    {formData.discountType === "free_shipping" ? " (Để trống nếu freeship toàn bộ)" : " *"}
                  </label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    min="0"
                    max={formData.discountType === "percentage" ? "100" : undefined}
                    required={formData.discountType !== "free_shipping"}
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>

                {formData.discountType === "percentage" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Giảm tối đa (đ)</label>
                    <input
                      type="number"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                      placeholder="Không giới hạn"
                      min="0"
                      className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Đơn hàng tối thiểu (đ)</label>
                <input
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Ngày bắt đầu *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Ngày kết thúc *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Tổng lượt sử dụng</label>
                  <input
                    type="number"
                    value={formData.maxUsage}
                    onChange={(e) => setFormData({ ...formData, maxUsage: e.target.value })}
                    placeholder="Không giới hạn"
                    min="1"
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Lượt/người dùng</label>
                  <input
                    type="number"
                    value={formData.maxUsagePerUser}
                    onChange={(e) => setFormData({ ...formData, maxUsagePerUser: e.target.value })}
                    min="1"
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFirstOrderOnly}
                    onChange={(e) => setFormData({ ...formData, isFirstOrderOnly: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Chỉ cho đơn hàng đầu tiên</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Kích hoạt ngay</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-gray-300 px-6 py-2.5 text-sm font-medium transition hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 bg-black px-6 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:bg-gray-300"
                >
                  {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingCoupon ? "Cập nhật" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
