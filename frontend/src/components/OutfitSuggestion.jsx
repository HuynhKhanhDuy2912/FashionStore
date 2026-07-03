import { useEffect, useState } from "react";
import { Shirt, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { apiRequest } from "../lib/api";
import ProductCard from "./ProductCard";

/**
 * Style label mapping
 */
const STYLE_LABELS = {
  casual: "Thường ngày",
  minimal: "Tối giản",
  streetwear: "Đường phố",
  sporty: "Thể thao",
  smart_casual: "Lịch sự",
  elegant: "Sang trọng",
  vintage: "Cổ điển"
};

/**
 * Occasion label mapping
 */
const OCCASION_LABELS = {
  casual: "Hàng ngày",
  street: "Dạo phố",
  sport: "Thể thao",
  travel: "Du lịch",
  date: "Hẹn hò",
  work: "Công sở",
  party: "Đi Tiệc",
  formal: "Trang trọng"
};

export default function OutfitSuggestion({
  productId,
  token = null,
  onAddToWishlist,
  onAddToCart,
  wishlistProductIds = new Set()
}) {
  const [outfit, setOutfit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (!productId) return;

    const loadOutfit = async () => {
      setLoading(true);
      setError(null);
      try {
        const options = token ? { token } : {};
        const response = await apiRequest(
          `/recommendations/outfit/${productId}?limit=8`,
          options
        );
        setOutfit(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadOutfit();
  }, [productId, token]);

  // Không render nếu không có outfit data
  if (!loading && (!outfit || !outfit.outfitItems || outfit.outfitItems.length === 0)) {
    return null;
  }

  // Skeleton loading
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-gray-200" />
          <div className="h-6 w-48 rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[4/5] bg-gray-200" />
              <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return null;

  const { outfitItems, outfitStyle, outfitOccasions } = outfit;

  // Group items by slot for display
  const slotGroups = {};
  outfitItems.forEach(item => {
    const slot = item.slot || "other";
    if (!slotGroups[slot]) slotGroups[slot] = [];
    slotGroups[slot].push(item);
  });

  const styleArray = Array.isArray(outfitStyle) ? outfitStyle : (outfitStyle ? [outfitStyle] : []);
  const styleLabels = styleArray
    .map(s => STYLE_LABELS[s] || s)
    .slice(0, 2);
  const occasionLabels = (outfitOccasions || [])
    .map(o => OCCASION_LABELS[o] || o)
    .slice(0, 3);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shirt className="h-4 w-4 text-gray-400" strokeWidth={2} />
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Phối đồ
            </p>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-black md:text-3xl">
            Hoàn thiện set đồ
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Gợi ý các sản phẩm phối hợp tốt dựa trên phong cách, dịp mặc và tầm giá
          </p>
        </div>

        {/* Style + Occasion tags */}
        <div className="flex flex-wrap items-center gap-2">
          {styleLabels.map((label, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600"
            >
              <Sparkles className="h-3 w-3 text-gray-500" strokeWidth={2} />
              {label}
            </span>
          ))}
          {occasionLabels.map((label, idx) => (
            <span
              key={idx}
              className="inline-flex items-center border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Outfit items grid (Carousel) */}
      <div className="group relative">
        {outfitItems.length > 4 ? (
          <>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) =>
                  prev === 0 ? Math.max(0, outfitItems.length - 4) : prev - 1
                )
              }
              className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm transition-opacity duration-200 hover:border-black opacity-100 md:opacity-0 md:group-hover:opacity-100 md:-left-5"
              aria-label="Xem sản phẩm trước"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) =>
                  prev === Math.max(0, outfitItems.length - 4) ? 0 : prev + 1
                )
              }
              className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm transition-opacity duration-200 hover:border-black opacity-100 md:opacity-0 md:group-hover:opacity-100 md:-right-5"
              aria-label="Xem sản phẩm tiếp theo"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {outfitItems
            .slice(currentPage, currentPage + 4)
            .map((item) => {
              return (
                <div key={item._id} className="relative group/outfit">
                  <ProductCard
                    product={item}
                    onAddToWishlist={onAddToWishlist}
                    onAddToCart={onAddToCart}
                    wishlistProductIds={wishlistProductIds}
                  />

                  {/* Complementary score badge (top-right) */}
                  {item.complementaryScore > 0 && (
                    <span className="pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center bg-black/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm shadow-sm">
                      {item.complementaryScore}% phù hợp
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
