import { useEffect, useRef, useState } from "react";
import { X, MessageCircleQuestion, Send, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


function UserAvatar({ user }) {
  const name = user?.fullname || user?.username || "?";
  const initials = name.charAt(0).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
      {initials}
    </div>
  );
}

export default function ProductQAModal({ productId, productName, onClose }) {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const textareaRef = useRef(null);

  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showForm, setShowForm] = useState(false);

  const LIMIT = 10;

  const loadQuestions = async (nextPage = 1, replace = true) => {
    try {
      setLoadingMore(true);
      const res = await apiRequest(
        `/product-questions?productId=${productId}&page=${nextPage}&limit=${LIMIT}`
      );
      const items = res.data || [];
      setQuestions((prev) => (replace ? items : [...prev, ...items]));
      setTotal(res.pagination?.total || 0);
      setPage(nextPage);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (productId) loadQuestions(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = questionText.trim();
    if (trimmed.length < 5) {
      toast.error("Câu hỏi cần ít nhất 5 ký tự.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/product-questions", {
        method: "POST",
        token,
        body: { productId, question: trimmed },
      });
      toast.success("Câu hỏi của bạn đã được gửi. Chúng tôi sẽ phản hồi sớm!");
      setQuestionText("");
      setShowForm(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasMore = questions.length < total;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex h-[90vh] w-full max-w-[600px] flex-col bg-white shadow-2xl mx-4">

        {/* Header */}
        <div className="flex items-center justify-between bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-[14px] font-bold uppercase tracking-widest text-black">
            Các câu hỏi thường gặp
          </h2>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center text-gray-500 hover:text-black transition cursor-pointer border-none bg-transparent"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Ask button / form */}
        <div className="px-6 py-4 pb-0">
          {!showForm ? (
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  onClose();
                  navigate("/login");
                  return;
                }
                setShowForm(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="w-full bg-black py-3.5 text-[14px] font-bold tracking-wide text-white transition hover:bg-gray-900 cursor-pointer border-none"
            >
              Đặt câu hỏi
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <textarea
                ref={textareaRef}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder={`Đặt câu hỏi về sản phẩm "${productName}"...`}
                rows={3}
                maxLength={500}
                className="w-full resize-none border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white placeholder:text-gray-400"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400">{questionText.length}/500</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setQuestionText(""); }}
                    className="border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:border-gray-900 transition cursor-pointer bg-white"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || questionText.trim().length < 5}
                    className="flex items-center gap-2 bg-gray-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
                  >
                    <Send size={13} />
                    {submitting ? "Đang gửi..." : "Gửi"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {!isAuthenticated && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Bạn cần{" "}
              <button
                onClick={() => { onClose(); navigate("/login"); }}
                className="font-medium text-gray-900 underline cursor-pointer border-none bg-transparent"
              >
                đăng nhập
              </button>{" "}
              để đặt câu hỏi.
            </p>
          )}
        </div>

        {/* Questions list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {questions.length === 0 && !loadingMore && !showForm && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-[15px] text-gray-500">Chưa có câu hỏi nào</p>
            </div>
          )}

          <div className="flex flex-col divide-y divide-gray-100 mt-2">
            {questions.map((q) => (
              <div key={q._id} className="flex flex-col gap-3 py-5 first:pt-2 last:pb-2">
                {/* Question */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-black uppercase">
                      {q.userId?.fullname || q.userId?.username || "NGƯỜI DÙNG"}
                    </span>
                    <span className="text-[11px] text-gray-500 shrink-0">
                      {formatDate(q.createdAt)}
                    </span>
                  </div>
                  <p className="text-[14px] text-black leading-relaxed">{q.question}</p>
                </div>

                {/* Admin Reply */}
                {q.isAnswered && q.answer && (
                  <div className="bg-[#f7ece2] px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[13px] font-bold text-black">
                        Admin FashionStore
                      </p>
                      {q.answeredAt && (
                        <span className="text-[11px] text-gray-500 shrink-0">
                          {formatDate(q.answeredAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-black leading-relaxed">{q.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="pb-4 pt-2 text-center">
              <button
                onClick={() => loadQuestions(page + 1, false)}
                disabled={loadingMore}
                className="flex items-center gap-2 mx-auto text-sm font-medium text-gray-600 hover:text-gray-900 transition cursor-pointer border-none bg-transparent disabled:opacity-50"
              >
                {loadingMore ? "Đang tải..." : (
                  <>
                    <ChevronDown size={15} />
                    Xem thêm ({total - questions.length} câu hỏi)
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {total > 0 && (
          <div className="border-t border-gray-100 px-6 py-3 text-center">
            <p className="text-[12px] text-gray-500">
              {total} câu hỏi về sản phẩm này
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
