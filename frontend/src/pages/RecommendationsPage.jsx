import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, RefreshCw, TrendingUp, Filter, X } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import ProductCard from "../components/ProductCard.jsx";
import RecommendationSection from "../components/RecommendationSection.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";
import { formatProductName } from "../lib/productName.js";

export default function RecommendationsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const itemsWithVariants = useMemo(
    () => attachVariantsToProducts(items, variants),
    [items, variants],
  );

  const loadRecommendations = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [recommendationResponse, variantResponse, wishlistResponse] = await Promise.all([
        apiRequest("/recommendations/me?limit=24", { token }),
        apiRequest("/product-variants?limit=1200"),
        token ? apiRequest("/wishlists/me", { token }) : Promise.resolve({ data: { items: [] } }),
      ]);

      setItems(recommendationResponse.data || []);
      setVariants(variantResponse.data || []);
      setWishlistProductIds(
        new Set((wishlistResponse.data?.items || []).map((item) => item.productId?._id).filter(Boolean)),
      );
      setError("");

      if (isRefresh) {
        setMessage("Đã làm mới gợi ý thành công!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    loadRecommendations();
  }, [token]);

  const handleWishlist = async (product) => {
    const productId = product?._id;
    if (!productId) return;
    if (!token) {
      navigate("/login");
      return;
    }

    const isWishlisted = wishlistProductIds.has(productId);

    try {
      if (isWishlisted) {
        await apiRequest(`/wishlists/me/product/${productId}`, {
          method: "DELETE",
          token,
        });
        setWishlistProductIds((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
        setMessage(`Đã bỏ ${formatProductName(product.name)} khỏi danh sách yêu thích`);
      } else {
        await apiRequest("/wishlists/me", {
          method: "POST",
          token,
          body: {
            productId,
            addedFrom: "recommendation"
          }
        });
        setWishlistProductIds((current) => {
          const next = new Set(current);
          next.add(productId);
          return next;
        });
        setMessage(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);
      }
      setTimeout(() => setMessage(""), 3000);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleAddToCart = async (product, variant) => {
    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: variant._id,
          quantity: 1,
          source: "recommendation"
        }
      });

      setMessage(`Đã thêm ${formatProductName(product.name)} vào giỏ hàng`);
      setTimeout(() => setMessage(""), 3000);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Toast notification */}
      {(message || error) && (
        <div
          className={`fixed bottom-6 right-4 z-50 flex max-w-sm items-start gap-3 border px-4 py-3 shadow-lg md:right-8 ${error
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-gray-200 bg-white text-black"
            }`}
        >
          <p className="flex-1 text-sm font-medium">{error || message}</p>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setError("");
            }}
            className="shrink-0 text-gray-400 transition hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero section */}
      <section className="border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white">
        <div className="mx-auto max-w-[1440px] px-4 py-12 md:px-8 md:pb-16">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-black" strokeWidth={2} />
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Cá nhân hóa
            </p>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-black md:text-4xl">
                Gợi ý dành riêng cho bạn
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
                Được chọn lọc thông minh dựa trên phong cách, sở thích và hành vi mua sắm của bạn.
                Hệ thống học từ mỗi lần tương tác để đưa ra gợi ý ngày càng chính xác hơn.
              </p>
            </div>

            <button
              onClick={() => loadRecommendations(true)}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center gap-2 border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:border-black hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Đang làm mới..." : "Làm mới gợi ý"}
            </button>
          </div>
        </div>
      </section>

      {/* Main recommendations */}
      <section className="mx-auto max-w-[1440px] px-4 py-12 md:px-8 md:pb-16">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[4/5] rounded-sm bg-gray-200" />
                <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
                <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : itemsWithVariants.length === 0 ? (
          <div className="rounded-sm border border-gray-200 bg-gray-50 py-20 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-xl font-bold uppercase tracking-widest text-black">
              Chưa có đủ dữ liệu
            </h3>
            <p className="mx-auto max-w-md text-sm text-gray-500">
              Hãy khám phá và tương tác với các sản phẩm để hệ thống có thể học sở thích của bạn và đưa ra gợi ý chính xác hơn.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-black">
                  {itemsWithVariants.length} sản phẩm được gợi ý
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Được cập nhật dựa trên hoạt động gần đây của bạn
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {itemsWithVariants.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onAddToWishlist={handleWishlist}
                  isWishlisted={wishlistProductIds.has(product._id)}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Trending section */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-[1440px] px-4 py-12 md:px-8 md:pb-16">
          <RecommendationSection
            type="trending"
            limit={8}
            onAddToWishlist={handleWishlist}
            onAddToCart={handleAddToCart}
            wishlistProductIds={wishlistProductIds}
          />
        </div>
      </section>
    </div>
  );
}
