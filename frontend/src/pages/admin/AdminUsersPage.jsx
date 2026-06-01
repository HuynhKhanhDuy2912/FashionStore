import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  Shield,
  User,
} from "lucide-react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import {
  getAvatarColorClass,
  getAvatarInitial,
  getUserDisplayName,
} from "../../lib/avatar.js";
import toast from "react-hot-toast";

const ROLES = [
  { value: "all", label: "Tất cả vai trò" },
  { value: "user", label: "Người dùng" },
  { value: "admin", label: "Quản trị viên" },
];

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang hoạt động" },
  { value: "inactive", label: "Bị khóa" },
];

const PAGE_SIZE = 10;

const formatDate = (val) => {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatLastLogin = (val) => {
  if (!val) return { text: "Chưa đăng nhập", level: "never" };
  const diffMs = Date.now() - new Date(val).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffMonths = Math.floor(diffDays / 30);

  let text;
  if (diffMins < 1) text = "Vừa xong";
  else if (diffMins < 60) text = `${diffMins} phút trước`;
  else if (diffHours < 24) text = `${diffHours} giờ trước`;
  else if (diffDays === 1) text = "Hôm qua";
  else if (diffDays < 30) text = `${diffDays} ngày trước`;
  else if (diffMonths < 12) text = `${diffMonths} tháng trước`;
  else text = `${Math.floor(diffMonths / 12)} năm trước`;

  const level = diffDays >= 180 ? "danger" : diffDays >= 30 ? "warning" : "ok";
  return { text, level, date: formatDate(val) };
};

function InitialAvatar({ user, className = "" }) {
  const displayName = getUserDisplayName(user);

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${getAvatarColorClass(
        user?._id || displayName,
      )} ${className}`}
      title={displayName}
    >
      {getAvatarInitial(displayName)}
    </div>
  );
}

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await apiRequest("/users?limit=200", { token });
      setUsers(res.data || []);
    } catch (err) {
      toast.error(err.message || "Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  // Stats
  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
    }),
    [users],
  );

  // Filter
  const filtered = useMemo(() => {
    let result = [...users];
    if (searchTerm.trim()) {
      const kw = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          (u.fullname || "").toLowerCase().includes(kw) ||
          (u.username || "").toLowerCase().includes(kw) ||
          (u.email || "").toLowerCase().includes(kw) ||
          (u.phone_number || "").includes(kw),
      );
    }
    if (roleFilter !== "all")
      result = result.filter((u) => u.role === roleFilter);
    if (statusFilter === "active") result = result.filter((u) => u.isActive);
    if (statusFilter === "inactive") result = result.filter((u) => !u.isActive);
    return result;
  }, [users, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  // Toggle active
  const toggleActive = async (user) => {
    try {
      await apiRequest(`/users/${user._id}`, {
        method: "PUT",
        token,
        body: { ...user, isActive: !user.isActive },
      });
      toast.success(
        user.isActive ? "Đã khóa tài khoản" : "Đã kích hoạt tài khoản",
      );
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Save edit
  const saveEdit = async () => {
    if (!editUser) return;
    try {
      setSaving(true);
      await apiRequest(`/users/${editUser._id}`, {
        method: "PUT",
        token,
        body: {
          role: editUser.role,
          isActive: editUser.isActive,
        },
      });
      toast.success("Cập nhật người dùng thành công");
      setEditUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiRequest(`/users/${deleteTarget._id}`, {
        method: "DELETE",
        token,
      });
      toast.success("Đã xóa người dùng");
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="grid gap-4 p-6">
      <AdminPageHeader
        title="QUẢN LÝ NGƯỜI DÙNG"
        description="Xem, tìm kiếm, phân quyền và quản lý tài khoản người dùng trong hệ thống."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Tổng người dùng",
            value: stats.total,
            icon: Users,
            iconBg: "bg-violet-50",
            iconColor: "text-violet-600",
          },
          {
            label: "Quản trị viên",
            value: stats.admins,
            icon: ShieldCheck,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-600",
            valueClass: "text-blue-600",
          },
          {
            label: "Đang hoạt động",
            value: stats.active,
            icon: UserCheck,
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-600",
            valueClass: "text-emerald-600",
          },
          {
            label: "Đang bị khóa",
            value: stats.inactive,
            icon: UserX,
            iconBg: "bg-red-50",
            iconColor: "text-red-600",
            valueClass: "text-red-600",
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

      {/* Filters */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-[13px] font-bold text-gray-500">
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Tên, email, số điện thoại..."
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-gray-500">
              Vai trò
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-gray-500">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-600">
            Tìm thấy{" "}
            <span className="font-semibold text-black">{filtered.length}</span>{" "}
            người dùng
          </span>
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Xóa bộ lọc
            </button>
            <button
              onClick={loadUsers}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-6 py-4 text-left">Người dùng</th>
                <th className="px-6 py-4">Liên hệ</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Ngày tạo</th>
                <th className="px-6 py-4">Truy cập cuối</th>
                <th className="px-6 py-4">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-center">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-gray-300" />
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-gray-200" />
                      Không tìm thấy người dùng phù hợp.
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((user) => (
                  <tr key={user._id} className="transition hover:bg-gray-50/70">
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center gap-3">
                        <InitialAvatar user={user} className="h-10 w-10 text-sm" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {getUserDisplayName(user)}
                          </p>
                          {/* <p className="text-xs text-gray-400">@{user.username}</p> */}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {user.email && (
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />{" "}
                            {user.email}
                          </span>
                        )}
                        {user.phone_number && (
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />{" "}
                            {user.phone_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === "admin" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          <ShieldCheck className="h-3.5 w-3.5" /> Quản trị viên
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                          <User className="h-3.5 w-3.5" /> Người dùng
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(user)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 cursor-pointer ${
                          user.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-600"
                        }`}
                      >
                        {user.isActive ? (
                          <UserCheck className="h-3.5 w-3.5" />
                        ) : (
                          <UserX className="h-3.5 w-3.5" />
                        )}
                        {user.isActive ? "Hoạt động" : "Bị khóa"}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatDate(user.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const { text, level, date } = formatLastLogin(
                          user.lastLoginAt,
                        );
                        const colorMap = {
                          ok: "text-emerald-600",
                          warning: "text-amber-600",
                          danger: "text-red-500",
                          never: "text-gray-400 italic",
                        };
                        return (
                          <span className="flex flex-col gap-0.5">
                            <span
                              className={`text-xs font-medium ${colorMap[level]}`}
                            >
                              {text}
                            </span>
                            {date && level !== "never" && (
                              <span className="text-xs text-gray-400">
                                {date}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditUser({ ...user })}
                          className="flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Sửa
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <span className="text-sm text-gray-500">
              Trang <span className="font-semibold">{currentPage}</span> /{" "}
              {totalPages} &mdash; {filtered.length} người dùng
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <InitialAvatar user={editUser} className="h-10 w-10 text-sm" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Chỉnh sửa người dùng
                  </h3>
                  <p className="text-xs text-gray-400">@{editUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setEditUser(null)}
                className="text-gray-400 transition hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Họ và tên
                  </label>
                  <input
                    disabled
                    value={editUser.fullname || ""}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Số điện thoại
                  </label>
                  <input
                    disabled
                    value={editUser.phone_number || ""}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Email
                </label>
                <input
                  disabled
                  value={editUser.email || ""}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Vai trò <span className="text-black font-bold"></span>
                  </label>
                  <select
                    value={editUser.role}
                    onChange={(e) =>
                      setEditUser((u) => ({ ...u, role: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
                  >
                    <option value="user">Người dùng</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Trạng thái <span className="text-black font-bold"></span>
                  </label>
                  <select
                    value={editUser.isActive ? "active" : "inactive"}
                    onChange={(e) =>
                      setEditUser((u) => ({
                        ...u,
                        isActive: e.target.value === "active",
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Bị khóa</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setEditUser(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-xl bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-bold text-gray-900">
                Xác nhận xóa người dùng
              </h3>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-gray-400 transition hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 p-4">
                <InitialAvatar user={deleteTarget} className="h-10 w-10 text-sm" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {getUserDisplayName(deleteTarget)}
                  </p>
                  <p className="text-xs text-gray-500">{deleteTarget.email}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Bạn có chắc muốn xóa người dùng này? Hành động này{" "}
                <span className="font-semibold text-red-600">
                  không thể hoàn tác
                </span>
                .
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
