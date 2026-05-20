import { Star } from "lucide-react";
import { useState } from "react";

function isVideoMedia(url = "") {
  return /\/video\/upload\/|\.mp4($|\?)|\.webm($|\?)|\.mov($|\?)/i.test(url);
}

export default function ReviewList({ reviews = [] }) {
  const [expandedReviews, setExpandedReviews] = useState(new Set());
  const [lightboxMedia, setLightboxMedia] = useState(null);

  if (!reviews || reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">Chưa có đánh giá nào cho sản phẩm này</p>
      </div>
    );
  }

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

  const openLightbox = (media) => {
    setLightboxMedia(media);
  };

  const closeLightbox = () => {
    setLightboxMedia(null);
  };

  return (
    <>
      <div className="space-y-6">
        {reviews.map((review) => {
          const isExpanded = expandedReviews.has(review._id);
          const hasLongComment = review.comment && review.comment.length > 200;
          const displayComment = hasLongComment && !isExpanded
            ? review.comment.slice(0, 200) + "..."
            : review.comment;

          return (
            <div key={review._id} className="border-b border-gray-200 pb-6 last:border-b-0">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {review.userId?.avatar ? (
                      <img
                        src={review.userId.avatar}
                        alt={review.userId.username || "User"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-600">
                        {(review.userId?.username || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-black">
                      {review.userId?.username || "Người dùng"}
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
                          className="ml-2 text-black font-medium underline hover:text-gray-700 transition"
                        >
                          {isExpanded ? "Thu gọn" : "Xem thêm"}
                        </button>
                      )}
                    </div>
                  )}

                  {review.imageUrls && review.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {review.imageUrls.map((url, index) => (
                        <button
                          key={index}
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
                    </div>
                  )}

                  {review.videoUrls && review.videoUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {review.videoUrls.map((url, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => openLightbox({ type: 'video', url })}
                          className="w-32 h-20 border border-gray-200 rounded overflow-hidden hover:opacity-80 transition cursor-pointer bg-transparent p-0 relative"
                        >
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                              <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-black border-b-4 border-b-transparent ml-0.5"></div>
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

      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-3xl font-light w-10 h-10 flex items-center justify-center border-none bg-transparent cursor-pointer"
            aria-label="Đóng"
          >
            ×
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
