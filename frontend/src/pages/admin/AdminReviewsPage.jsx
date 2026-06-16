import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { formatProductName } from "../../lib/productName.js";
import {
  Eye,
  EyeOff,
  Search,
  Star,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { getPaginationRange } from "../../lib/pagination.js";
import toast from "react-hot-toast";

export default function AdminReviewsPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("q") || "";

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(globalSearch);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [expandedReviewId, setExpandedReviewId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      if (statusFilter === "visible") {
        params.append("isHidden", "false");
      } else if (statusFilter === "hidden") {
        params.append("isHidden", "true");
      }

      if (ratingFilter !== "all") {
        params.append("rating", ratingFilter);
      }

      const res = await apiRequest(`/reviews/admin/list?${params.toString()}`, {
        token,
      });

      setReviews(res.data || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [token, page, statusFilter, ratingFilter, searchTerm]);

  useEffect(() => {
    setSearchTerm(globalSearch);
    setPage(1);
  }, [globalSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadReviews();
  };

  const handleToggleVisibility = async (reviewId, currentIsHidden) => {
    try {
      const endpoint = currentIsHidden
        ? `/reviews/admin/${reviewId}/show`
        : `/reviews/admin/${reviewId}/hide`;

      await apiRequest(endpoint, {
        method: "PATCH",
        token,
      });

      toast.success(
        currentIsHidden ? "Đã hiển thị đánh giá" : "Đã ẩn đánh giá",
      );
      loadReviews();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleReviewDetail = (reviewId) => {
    setExpandedReviewId(expandedReviewId === reviewId ? null : reviewId);
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            }
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const inputCls =
    "border border-gray-200 rounded-lg px-4 py-2.5 bg-white text-black text-sm focus:border-black focus:outline-none transition-colors";

  return (
    <section className="grid gap-4 p-6">
      <AdminPageHeader
        title="QUẢN LÝ BÌNH LUẬN"
        description={`Tổng cộng ${total} đánh giá`}
      />

      <div className="bg-white border border-gray-200 p-6 rounded-md">
        <div className="grid gap-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 flex items-center border border-gray-200 px-3 py-2 bg-white rounded-lg">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                className="ml-2 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                placeholder="Tìm kiếm theo nội dung bình luận..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 transition-colors rounded-md"
            >
              Tìm kiếm
            </button>
          </form>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1.5 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Trạng thái
              </span>
              <select
                className={inputCls}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả</option>
                <option value="visible">Đang hiện</option>
                <option value="hidden">Đã ẩn</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Đánh giá
              </span>
              <select
                className={inputCls}
                value={ratingFilter}
                onChange={(e) => {
                  setRatingFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả</option>
                <option value="5">5 sao</option>
                <option value="4">4 sao</option>
                <option value="3">3 sao</option>
                <option value="2">2 sao</option>
                <option value="1">1 sao</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md">
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Đang tải...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400 m-0">Không có đánh giá nào</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reviews.map((review) => (
              <div
                key={review._id}
                className="p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="grid grid-cols-[80px_1fr_120px_100px_120px] gap-4 items-start">
                  <div className="w-16 h-16 bg-gray-100 border border-gray-200 overflow-hidden">
                    {review.productId?.images?.[0] ? (
                      <img
                        src={review.productId.images[0]}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[8px] text-gray-300 uppercase">
                        N/A
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      {formatProductName(review.productId?.name) || "Sản phẩm đã xóa"}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                        {review.userId?.avatar ? (
                          <img
                            src={review.userId.avatar}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-[10px] font-bold text-gray-500">
                            {(review.userId?.username || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-black">
                        {review.userId?.fullname ||
                          review.userId?.username ||
                          "Người dùng"}
                      </span>
                    </div>
                    {renderStars(review.rating)}
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      {review.comment || (
                        <span className="text-gray-400 italic">
                          Không có nội dung
                        </span>
                      )}
                    </p>
                    {(review.imageUrls?.length > 0 ||
                      review.videoUrls?.length > 0 ||
                      review.comment?.length > 100) && (
                        <button
                          type="button"
                          onClick={() => toggleReviewDetail(review._id)}
                          className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-transparent border-none cursor-pointer p-0"
                        >
                          {expandedReviewId === review._id ? (
                            <>
                              <ChevronUp size={14} /> Thu gọn
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} /> Xem chi tiết
                            </>
                          )}
                        </button>
                      )}
                  </div>

                  <div className="text-center">
                    <p className="text-[13px] text-gray-500">
                      {formatDate(review.createdAt)}
                    </p>
                  </div>

                  <div className="text-center">
                    <span
                      className={`inline-block px-3 py-1 text-[13px] font-bold rounded-lg ${review.isHidden
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                        }`}
                    >
                      {review.isHidden ? "Đã ẩn" : "Đang hiện"}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleVisibility(review._id, review.isHidden)
                      }
                      className={`px-3 py-2 text-xs font-bold uppercase tracking-widest border cursor-pointer transition-colors ${review.isHidden
                        ? "text-green-700 border-green-700 hover:bg-green-700 hover:text-white rounded-lg"
                        : "text-red-600 border-red-400 hover:bg-red-600 hover:text-white rounded-lg"
                        }`}
                      title={
                        review.isHidden ? "Hiển thị đánh giá" : "Ẩn đánh giá"
                      }
                    >
                      {review.isHidden ? (
                        <>
                          <Eye size={14} className="inline mr-1" /> HIỆN
                        </>
                      ) : (
                        <>
                          <EyeOff size={14} className="inline mr-1" /> ẨN
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {expandedReviewId === review._id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {review.comment && (
                      <div className="mb-4">
                        <p className="text-[13px] font-bold text-gray-500 mb-2">
                          Nội dung đầy đủ
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {review.comment}
                        </p>
                      </div>
                    )}

                    {(review.imageUrls?.length > 0 ||
                      review.videoUrls?.length > 0) && (
                        <div>
                          <p className="text-[13px] font-bold text-gray-500 mb-2">
                            Hình ảnh & Video (
                            {(review.imageUrls?.length || 0) +
                              (review.videoUrls?.length || 0)}
                            )
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(review.imageUrls || []).map((url, idx) => (
                              <a
                                key={`img-${idx}`}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-24 h-24 border border-gray-200 overflow-hidden hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={url}
                                  className="w-full h-full object-cover"
                                  alt={`Review image ${idx + 1}`}
                                />
                              </a>
                            ))}

                            {(review.videoUrls || []).map((url, idx) => (
                              <a
                                key={`video-${idx}`}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-24 h-24 border border-gray-200 overflow-hidden bg-black"
                              >
                                <video
                                  src={url}
                                  className="w-full h-full object-cover"
                                  controls
                                  preload="metadata"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange(page, totalPages).map((p) => {
                  if (p === "left-ellipsis" || p === "right-ellipsis") {
                    return (
                      <span key={`ellipsis-${p}`} className="px-1 text-gray-400">...</span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 w-8 rounded text-sm font-medium ${page === p
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
                disabled={page === totalPages}
                className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
