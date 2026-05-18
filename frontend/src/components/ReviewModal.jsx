import { Star, X, Camera, Video } from "lucide-react";

const getObjectUrl = (file) => URL.createObjectURL(file);

export default function ReviewModal({
  open,
  onClose,
  onSubmit,
  submitting,
  productName,
  productSku,
  imageUrl,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  selectedImages,
  selectedVideos,
  onImageFilesChange,
  onVideoFilesChange,
  onRemoveSelectedImage,
  onRemoveSelectedVideo,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-black">
            Viết đánh giá sản phẩm
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-black transition"
            aria-label="Đóng form đánh giá"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex gap-4 pb-5 border-b border-gray-200">
            <div className="w-20 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={productName}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-black line-clamp-2">
                {productName}
              </h3>
              <p className="text-xs text-gray-500 mt-1">SKU: {productSku}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-black mb-3">
              Chất lượng sản phẩm
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onRatingChange(star)}
                  className="border-none bg-transparent p-0 cursor-pointer transition-transform hover:scale-110"
                  aria-label={`${star} sao`}
                >
                  <Star
                    size={32}
                    className={
                      star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-black mb-2">
              Đánh giá chi tiết
            </label>
            <textarea
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Bạn có thể nói thêm về sản phẩm ở đây. Vd: sản phẩm chất lượng tốt, thoải mái,..."
              className="w-full resize-none border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center border border-gray-300 bg-white text-gray-500 transition hover:border-black hover:text-black">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  onImageFilesChange(files);
                  event.target.value = "";
                }}
              />
              <Camera className="mb-2 h-6 w-6" strokeWidth={1.5} />
              <span className="text-sm font-medium">Thêm hình ảnh</span>
            </label>

            <label className="flex h-24 cursor-pointer flex-col items-center justify-center border border-gray-300 bg-white text-gray-500 transition hover:border-black hover:text-black">
              <input
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  onVideoFilesChange(files);
                  event.target.value = "";
                }}
              />
              <Video className="mb-2 h-6 w-6" strokeWidth={1.5} />
              <span className="text-sm font-medium">Thêm video</span>
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black py-3 text-l font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </div>
      </form>
    </div>
  );
}
