import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import { Link, useSearchParams } from "react-router-dom";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { getProductPath } from "../../lib/slug.js";
import { formatProductName } from "../../lib/productName.js";
import {
  MessageCircleQuestion,
  Search,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Send,
  ChevronsLeft,
  ChevronsRight,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { getPaginationRange } from "../../lib/pagination.js";
import toast from "react-hot-toast";

const filterOptions = [
  { value: "all", label: "Tất cả" },
  { value: "unanswered", label: "Chưa trả lời" },
  { value: "answered", label: "Đã trả lời" },
];

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminProductQuestionsPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("q") || "";
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState(globalSearch);
  const [searchInput, setSearchInput] = useState(globalSearch);

  // Answer state
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadQuestions = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 15 });
        if (filter === "answered") params.set("isAnswered", "true");
        if (filter === "unanswered") params.set("isAnswered", "false");
        if (search.trim()) params.set("search", search.trim());

        const res = await apiRequest(`/product-questions/admin?${params}`, { token });
        setQuestions(res.data || []);
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
      } catch {
        toast.error("Không thể tải danh sách câu hỏi.");
      } finally {
        setLoading(false);
      }
    },
    [token, filter, search]
  );

  useEffect(() => {
    loadQuestions(1);
  }, [loadQuestions]);

  useEffect(() => {
    setSearch(globalSearch);
    setSearchInput(globalSearch);
  }, [globalSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleAnswer = async (id) => {
    const trimmed = answerText.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await apiRequest(`/product-questions/${id}/answer`, {
        method: "PATCH",
        token,
        body: { answer: trimmed },
      });
      toast.success("Đã trả lời câu hỏi.");
      setAnsweringId(null);
      setAnswerText("");
      loadQuestions(pagination.page);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleHide = async (q) => {
    try {
      const action = q.isHidden ? "show" : "hide";
      await apiRequest(`/product-questions/${q._id}/${action}`, {
        method: "PATCH",
        token,
      });
      toast.success(q.isHidden ? "Đã hiển thị câu hỏi." : "Đã ẩn câu hỏi.");
      loadQuestions(pagination.page);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setIsDeleting(true);
      await apiRequest(`/product-questions/${deleteConfirm._id}`, {
        method: "DELETE",
        token,
      });
      toast.success("Đã xóa câu hỏi.");
      setDeleteConfirm(null);
      loadQuestions(pagination.page);
    } catch (err) {
      toast.error(err.message || "Không thể xóa câu hỏi.");
    } finally {
      setIsDeleting(false);
    }
  };

  const startAnswer = (q) => {
    setAnsweringId(q._id);
    setAnswerText(q.answer || "");
  };

  const counts = useMemo(() => {
    return {
      total: pagination.total,
    };
  }, [pagination]);

  return (
    <div className="grid gap-4 p-6">
      <AdminPageHeader
        title="QUẢN LÝ CÂU HỎI SẢN PHẨM"
        description={`${counts.total} câu hỏi từ khách hàng`}
      />

      {/* Filters & search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50/50 p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 text-sm font-medium transition cursor-pointer border-none rounded-md ${filter === opt.value
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex flex-1 max-w-lg items-center gap-3">
          <div className="flex-1 flex items-center border border-gray-200 px-3 py-2 bg-white rounded-lg focus-within:border-gray-900 transition-all">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm câu hỏi..."
              className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer border-none bg-transparent flex items-center pl-2"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 transition-colors rounded-lg cursor-pointer shrink-0"
          >
            Tìm kiếm
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
          </div>
        ) : questions.length === 0 ? (
          <div className="py-20 text-center">
            <MessageCircleQuestion size={40} className="mx-auto mb-3 text-gray-200" strokeWidth={1.5} />
            <p className="text-sm text-gray-400">Không có câu hỏi nào.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3 font-medium">Người hỏi</th>
                <th className="px-5 py-3 font-medium">Sản phẩm</th>
                <th className="px-5 py-3 font-medium">Câu hỏi</th>
                <th className="px-5 py-3 font-medium text-center">Trạng thái</th>
                <th className="px-5 py-3 font-medium text-center">Ngày</th>
                <th className="px-5 py-3 font-medium text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {questions.map((q) => {
                const userName = q.userId?.fullname || q.userId?.username || "Người dùng";
                const productName = formatProductName(q.productId?.name) || "Sản phẩm";
                const isExpanded = answeringId === q._id;

                return (
                  <tr key={q._id} className="group hover:bg-gray-50/50 transition">
                    {/* User */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{userName}</span>
                      </div>
                    </td>

                    {/* Product */}
                    <td className="px-5 py-4 align-top">
                      {q.productId ? (
                        <Link
                          to={getProductPath(q.productId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline line-clamp-2 max-w-[180px] transition"
                        >
                          {productName}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-600 line-clamp-1 max-w-[180px]">{productName}</span>
                      )}
                    </td>

                    {/* Question + Answer inline */}
                    <td className="px-5 py-4 align-top max-w-[300px]">
                      <p className="text-sm text-gray-800 line-clamp-2">{q.question}</p>
                      {q.isAnswered && q.answer && !isExpanded && (
                        <div className="mt-2 rounded border-l-2 border-gray-300 bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500 line-clamp-2">{q.answer}</p>
                        </div>
                      )}

                      {/* Inline answer form */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            autoFocus
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            rows={3}
                            placeholder="Nhập câu trả lời..."
                            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900 placeholder:text-gray-400"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAnswer(q._id)}
                              disabled={submitting || !answerText.trim()}
                              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-gray-700 disabled:opacity-50 cursor-pointer border-none"
                            >
                              <Send size={12} />
                              {submitting ? "Đang gửi..." : q.isAnswered ? "Cập nhật" : "Trả lời"}
                            </button>
                            <button
                              onClick={() => { setAnsweringId(null); setAnswerText(""); }}
                              className="rounded-lg border border-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 cursor-pointer bg-red-600 font-bold"
                            >
                              Huỷ
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-center align-top">
                      {q.isHidden ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                          <EyeOff size={11} /> Đã ẩn
                        </span>
                      ) : q.isAnswered ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 size={11} /> Đã trả lời
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          <Clock3 size={11} /> Chờ trả lời
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 text-center align-top">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(q.createdAt)}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-center align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => (isExpanded ? setAnsweringId(null) : startAnswer(q))}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900 cursor-pointer bg-white"
                          title={q.isAnswered ? "Sửa câu trả lời" : "Trả lời"}
                        >
                          {q.isAnswered ? "Sửa" : "Trả lời"}
                        </button>
                        <button
                          onClick={() => handleToggleHide(q)}
                          className={`rounded-lg border px-2 py-1.5 text-xs transition cursor-pointer ${q.isHidden
                            ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white"
                            : "border-red-200 text-red-500 hover:bg-red-50 bg-white"
                            }`}
                          title={q.isHidden ? "Hiện" : "Ẩn"}
                        >
                          {q.isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(q)}
                          className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 cursor-pointer"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <span className="text-sm text-gray-500">
              Trang {pagination.page} / {pagination.totalPages} &mdash; {pagination.total} câu hỏi
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => loadQuestions(Math.max(pagination.page - 1, 1))}
                disabled={pagination.page <= 1}
                className="flex items-center justify-center rounded-lg bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 border border-gray-200 transition"
              >
                <ChevronsLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange(pagination.page, pagination.totalPages).map((p) => {
                  if (p === "left-ellipsis" || p === "right-ellipsis") {
                    return (
                      <span key={`ellipsis-${p}`} className="px-1 text-gray-400">...</span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => loadQuestions(p)}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${pagination.page === p
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
                onClick={() => loadQuestions(Math.min(pagination.page + 1, pagination.totalPages))}
                disabled={pagination.page >= pagination.totalPages}
                className="flex items-center justify-center rounded-lg bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 border border-gray-200 transition"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900">Xóa câu hỏi</h3>
            <p className="mt-2 text-sm text-gray-500">
              Bạn có chắc chắn muốn xóa câu hỏi này?
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900 line-clamp-2">
              {deleteConfirm.question}
            </p>
            <p className="mt-2 flex gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Hành động này không thể hoàn tác và sẽ xóa vĩnh viễn câu hỏi này.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isDeleting ? "Đang xóa..." : "Xóa"}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 rounded border border-gray-300 bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
