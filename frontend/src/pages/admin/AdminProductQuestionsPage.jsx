import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import { Link } from "react-router-dom";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { getProductPath } from "../../lib/slug.js";
import {
  MessageCircleQuestion,
  Search,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Send,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
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
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Answer state
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition cursor-pointer border-none ${filter === opt.value
                ? "bg-gray-900 text-white rounded-md"
                : "bg-transparent text-gray-500 hover:text-gray-900"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 ml-auto">
          <div className="flex items-center border border-gray-200 bg-white px-3 py-1.5 rounded-lg">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm câu hỏi..."
              className="w-48 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer border-none bg-transparent"
              >
                <X size={13} />
              </button>
            )}
          </div>
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
                const productName = q.productId?.name || "Sản phẩm";
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
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 transition cursor-pointer bg-white"
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
            <span className="text-xs text-gray-400">
              Trang {pagination.page}/{pagination.totalPages} — {pagination.total} câu hỏi
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadQuestions(pagination.page - 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 cursor-pointer bg-white"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadQuestions(pagination.page + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 cursor-pointer bg-white"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
