import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, Heart } from "lucide-react";
import ProductCard from "./ProductCard";
import { apiRequest } from "../lib/api";
import { attachVariantsToProducts } from "../lib/catalog";

export default function BestSellersSection({
  limit = 12,
  excludeProductId = null,
  title = "Bán chạy nhất",
  description = "Những sản phẩm được khách hàng đánh giá và mua nhiều nhất.",
  eyebrow = "Yêu thích",
  showViewAll = true,
  onAddToWishlist,
  onAddToCart,
  wishlistProductIds = new Set(),
  className = "",
  icon: Icon = Heart,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [productRes, variantRes, collectionRes] = await Promise.all([
          apiRequest("/products?limit=200"),
          apiRequest("/product-variants?limit=2000"),
          apiRequest("/collections?limit=50&isActive=true"),
        ]);

        if (cancelled) return;

        const raw = productRes.data || [];
        const rawVariants = variantRes.data || [];
        const rawCollections = collectionRes.data || [];

        // Build productId → collectionName map
        const collectionMap = new Map();
        rawCollections.forEach((col) => {
          if (!col?.isActive) return;
          (col.products || []).forEach((item) => {
            const pid = String(item?._id || item);
            if (pid && !collectionMap.has(pid)) {
              collectionMap.set(pid, col.name);
            }
          });
        });

        const withVariants = attachVariantsToProducts(raw, rawVariants);

        const sorted = withVariants
          .filter(
            (p) =>
              Number(p.soldCount || 0) > 0 &&
              (!excludeProductId || String(p._id) !== String(excludeProductId))
          )
          .sort((a, b) => {
            const soldDiff =
              Number(b.soldCount || 0) - Number(a.soldCount || 0);
            if (soldDiff !== 0) return soldDiff;
            return Number(b.totalReviews || 0) - Number(a.totalReviews || 0);
          })
          .slice(0, limit)
          .map((p) => ({
            ...p,
            collectionName: collectionMap.get(String(p._id)) || p.collectionName || null,
          }));

        setProducts(sorted);
      } catch (err) {
        console.error("BestSellersSection error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [limit, excludeProductId]);

  const pageCount = Math.max(1, products.length - 3);

  const visibleProducts = useMemo(
    () => products.slice(currentPage, currentPage + 4),
    [products, currentPage]
  );

  useEffect(() => {
    if (currentPage >= pageCount) setCurrentPage(0);
  }, [currentPage, pageCount]);

  // Không render nếu không có sản phẩm và đã load xong
  if (!loading && products.length === 0) return null;

  return (
    <section className={className}>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-gray-400" strokeWidth={2} />}
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
              {eyebrow}
            </p>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-black md:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
              {description}
            </p>
          ) : null}
        </div>

        {showViewAll ? (
          <Link
            to="/products?bestSeller=1"
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
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] rounded-sm bg-gray-200" />
              <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : (
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
                className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:border-black md:-left-5"
                aria-label="Xem sản phẩm bán chạy trước"
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
                className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:border-black md:-right-5"
                aria-label="Xem sản phẩm bán chạy tiếp theo"
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
      )}
    </section>
  );
}
