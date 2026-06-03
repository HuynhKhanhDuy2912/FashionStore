import { Star, X } from "lucide-react";
import { useState } from "react";

export default function ReviewsModal({ open, onClose, reviews = [], averageRating = 0, totalReviews = 0, onWriteReview }) {
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState(new Set());

  if (!open) return null;

  const roundedRating = Math.round(averageRating);

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => r.rating === star).length;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return { star, count, percentage };
  });

  const openLightbox = (media) => {
    setLightboxMedia(media);
  };

  const closeLightbox = () => {
    setLightboxMedia(null);
  };

  const toggleExpand = (reviewId) => {
    setExpandedReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-5xl bg-white shadow-2xl max-h-[550px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-black">
              Đánh giá sản phẩm
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-black transition"
              aria-label="Đóng"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar - Rating Overview */}
            <div className="w-80 border-r border-gray-200 p-6 flex flex-col">
              <div className="mb-6">
                <div className="text-2xl font-bold text-black mb-2">
                  {totalReviews} <span className="text-2xl">Đánh giá</span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star
                      key={i}
                      size={24}
                      className={
                        i <= roundedRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-2 mb-6">
                {ratingDistribution.map(({ star, count, percentage }) => (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm w-3">{star}</span>
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>

              {/* Write Review Button */}
              <button
                type="button"
                onClick={onWriteReview}
                className="w-full bg-black text-white py-3 text-sm font-bold hover:bg-gray-800 transition"
              >
                Viết đánh giá sản phẩm
              </button>
            </div>

            {/* Right - Reviews List */}
            <div
              className="flex-1 overflow-y-auto p-6"
              style={{
                /* Tùy chỉnh thanh cuộn cho webkit */
                scrollbarWidth: "thin",
                scrollbarColor: "#d1d5db #f3f4f6"
              }}
            >
              {reviews.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm">Chưa có đánh giá nào</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => {
                    const isExpanded = expandedReviews.has(review._id);
                    const hasLongComment = review.comment && review.comment.length > 200;
                    const displayComment = hasLongComment && !isExpanded
                      ? review.comment.slice(0, 200) + "..."
                      : review.comment;

                    const userName = review.userId?.fullname || review.userId?.username || "User";
                    const initial = userName.charAt(0).toUpperCase();
                    const colors = ["bg-red-500", "bg-orange-500", "bg-green-500", "bg-blue-500", "bg-purple-500", "bg-pink-500"];
                    const colorIndex = userName.charCodeAt(0) % colors.length;
                    const bgColor = colors[colorIndex];

                    return (
                      <div key={review._id} className="border-b border-gray-200 pb-6 last:border-b-0">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden text-white font-bold relative ${bgColor}`}>
                              <span className="z-0">{initial}</span>
                              {review.userId?.avatar && (
                                <img
                                  src={review.userId.avatar}
                                  alt={userName}
                                  className="w-full h-full object-cover absolute inset-0 z-10"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-black">
                                {review.userId?.fullname || "Người dùng"}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 mb-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={14}
                                  className={
                                    star <= review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }
                                />
                              ))}
                            </div>

                            {review.comment && (
                              <div className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">
                                {displayComment}
                                {hasLongComment && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(review._id)}
                                    className="ml-2 text-black font-medium underline hover:text-gray-700 transition bg-transparent border-none p-0 cursor-pointer"
                                  >
                                    {isExpanded ? "Thu gọn" : "Xem thêm"}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Ảnh và Video chung 1 hàng */}
                            {((review.imageUrls && review.imageUrls.length > 0) || (review.videoUrls && review.videoUrls.length > 0)) && (
                              <div className="flex flex-wrap gap-2">
                                {/* Hiển thị ảnh */}
                                {review.imageUrls && review.imageUrls.map((url, index) => (
                                  <button
                                    key={`img-${index}`}
                                    type="button"
                                    onClick={() => openLightbox({ type: 'image', url })}
                                    className="w-20 h-20 border border-gray-200 rounded overflow-hidden hover:opacity-80 transition cursor-pointer bg-transparent p-0"
                                  >
                                    <img
                                      src={url}
                                      alt={`Review ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}

                                {/* Hiển thị video */}
                                {review.videoUrls && review.videoUrls.map((url, index) => (
                                  <button
                                    key={`vid-${index}`}
                                    type="button"
                                    onClick={() => openLightbox({ type: 'video', url })}
                                    className="w-20 h-20 border border-gray-200 rounded overflow-hidden hover:opacity-80 transition cursor-pointer bg-transparent p-0 relative"
                                  >
                                    <video
                                      src={url}
                                      className="w-full h-full object-cover"
                                      preload="metadata"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                                        <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-black border-b-[5px] border-b-transparent ml-0.5"></div>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-3xl font-light w-10 h-10 flex items-center justify-center border-none bg-transparent cursor-pointer"
            aria-label="Đóng"
          >
            <X size={24} strokeWidth={1.5} />
          </button>

          <div className="max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            {lightboxMedia.type === 'image' ? (
              <img
                src={lightboxMedia.url}
                alt="Review"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
