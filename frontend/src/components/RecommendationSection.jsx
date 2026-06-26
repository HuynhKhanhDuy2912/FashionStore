import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, ArrowRight, ArrowLeft, Heart, PackagePlus } from "lucide-react";
import ProductCard from "./ProductCard";
import { apiRequest } from "../lib/api";

/**
 * RecommendationSection - Component hiển thị gợi ý sản phẩm cá nhân hóa với carousel
 * Hỗ trợ 3 loại: personalized, similar, trending
 */
export default function RecommendationSection({
  type = "personalized", // "personalized" | "similar" | "trending"
  productId = null, // Required for type="similar"
  token = null,
  limit = 12,
  title,
  description,
  eyebrow,
  onAddToWishlist,
  onAddToCart,
  wishlistProductIds = new Set(),
  className = "",
  showAIBadge = false, // Show AI badge for personalized recommendations
  excludeIds = [] // Array of product IDs to exclude
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const loadRecommendations = async () => {
      setLoading(true);
      setError(null);

      try {
        let endpoint = "";
        let options = {};

        switch (type) {
          case "personalized":
            if (!token) {
              setLoading(false);
              return;
            }
            endpoint = `/recommendations/me?limit=${limit}`;
            options = { token };
            break;

          case "similar":
            if (!productId) {
              setError("Product ID is required for similar products");
              setLoading(false);
              return;
            }
            endpoint = `/recommendations/similar/${productId}?limit=${limit}`;
            break;

          case "trending":
            endpoint = `/recommendations/trending?limit=${limit}`;
            break;

          case "personalized-bestsellers":
            if (!token) {
              setLoading(false);
              return;
            }
            endpoint = `/recommendations/personalized-bestsellers?limit=${limit}`;
            options = { token };
            break;

          case "personalized-new-arrivals":
            if (!token) {
              setLoading(false);
              return;
            }
            endpoint = `/recommendations/personalized-new-arrivals?limit=${limit}`;
            options = { token };
            break;

          default:
            setError("Invalid recommendation type");
            setLoading(false);
            return;
        }

        const response = await apiRequest(endpoint, options);
        let fetchedProducts = response.data || [];

        if (excludeIds && excludeIds.length > 0) {
          fetchedProducts = fetchedProducts.filter(
            p => !excludeIds.includes(p._id)
          );
        }

        setProducts(fetchedProducts);
      } catch (err) {
        console.error("Recommendation error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, [type, productId, token, limit]);

  // Carousel logic
  const pageCount = Math.max(1, products.length - 3);
  const visibleProducts = useMemo(() => {
    const start = currentPage;
    return products.slice(start, start + 4);
  }, [products, currentPage]);

  useEffect(() => {
    if (currentPage >= pageCount) {
      setCurrentPage(0);
    }
  }, [currentPage, pageCount]);

  // Don't render if no products and not loading
  if (!loading && products.length === 0) {
    return null;
  }

  // Default titles based on type
  const defaultTitles = {
    personalized: "Gợi ý dành cho bạn",
    similar: "Sản phẩm tương tự",
    trending: "Đang thịnh hành",
    "personalized-bestsellers": "Bán chạy trong phong cách của bạn",
    "personalized-new-arrivals": "Mới về - phù hợp với bạn"
  };

  const defaultDescriptions = {
    personalized: "Được chọn lọc dựa trên sở thích và hành vi mua sắm của bạn",
    similar: "Những sản phẩm có đặc điểm tương tự với sản phẩm bạn đang xem",
    trending: "Sản phẩm được quan tâm và mua nhiều nhất tuần này",
    "personalized-bestsellers": "Những sản phẩm được yêu thích nhất trong nhóm phong cách của bạn",
    "personalized-new-arrivals": "Sản phẩm mới ra mắt phù hợp với gu thời trang của bạn"
  };

  const defaultEyebrows = {
    personalized: "Cá nhân hóa",
    similar: "Có thể bạn thích",
    trending: "Hot trend",
    "personalized-bestsellers": "Sản phẩm bán chạy",
    "personalized-new-arrivals": "Sản phẩm mới về"
  };

  const icons = {
    personalized: Sparkles,
    similar: ArrowRight,
    trending: TrendingUp,
    "personalized-bestsellers": Heart,
    "personalized-new-arrivals": PackagePlus
  };

  const Icon = icons[type];

  const finalTitle = title || defaultTitles[type];
  const finalDescription = description || defaultDescriptions[type];
  const finalEyebrow = eyebrow || defaultEyebrows[type];

  return (
    <section className={`${className}`}>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-400" strokeWidth={2} />
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
                {finalEyebrow}
              </p>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-black md:text-3xl">
            {finalTitle}
          </h2>
          {finalDescription ? (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
              {finalDescription}
            </p>
          ) : null}
        </div>

        {(type === "personalized" || type === "personalized-bestsellers" || type === "personalized-new-arrivals") && token ? (
          <Link
            to={type === "personalized" ? "/recommendations" : (type === "personalized-bestsellers" ? "/products?bestSeller=1" : "/products?newArrivals=1")}
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-black transition hover:gap-3"
          >
            Xem tất cả
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="aspect-[4/5] rounded-sm bg-gray-200" />
              <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="group relative">
            {products.length > 4 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      prev === 0 ? pageCount - 1 : prev - 1
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
                      prev === pageCount - 1 ? 0 : prev + 1
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
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onAddToWishlist={onAddToWishlist}
                  onAddToCart={onAddToCart}
                  isWishlisted={wishlistProductIds.has(product._id)}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
