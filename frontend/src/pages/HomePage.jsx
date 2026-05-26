import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import ProductCard from "../components/ProductCard.jsx";
import RecommendationSection from "../components/RecommendationSection.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";

const categoryCards = [
  {
    title: "Thời trang nam",
    copy: "Form dáng thoải mái, tone màu nhã nhặn và những món đồ cơ bản linh hoạt.",
    link: "/products?gender=male",
    image: "/images/nam.jpg",
  },
  {
    title: "Thời trang nữ",
    copy: "Đường nét mềm mại, layer thông minh và trang phục dạo phố thanh lịch.",
    link: "/products?gender=female",
    image: "/images/nu.jpg",
  },
  {
    title: "Bộ sưu tập",
    copy: "Khám phá các câu chuyện thời trang được tuyển chọn theo mùa và phong cách.",
    link: "/collections",
    image: "/images/bst.jpg",
  },
];

const trustItems = [
  {
    icon: Truck,
    title: "Giao hàng toàn quốc",
    copy: "Miễn phí đơn từ 500.000₫",
  },
  {
    icon: RotateCcw,
    title: "Đổi trả 30 ngày",
    copy: "Quy trình đơn giản, nhanh chóng",
  },
  {
    icon: ShieldCheck,
    title: "Thanh toán an toàn",
    copy: "MoMo, VNPay, PayPal",
  },
  {
    icon: Headphones,
    title: "Hỗ trợ 24/7",
    copy: "Tư vấn mọi lúc bạn cần",
  },
];

function SectionHeader({
  eyebrow,
  title,
  description,
  linkTo,
  linkLabel = "Xem tất cả",
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-bold tracking-tight text-black md:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
            {description}
          </p>
        ) : null}
      </div>
      {linkTo ? (
        <Link
          to={linkTo}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-black transition hover:gap-3"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-[4/5] rounded-sm bg-gray-200" />
          <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function Toast({ message, error, onClose }) {
  if (!message && !error) return null;

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-4 z-50 flex max-w-sm items-start gap-3 border px-4 py-3 shadow-lg md:right-8 ${
        error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-gray-200 bg-white text-black"
      }`}
    >
      <p className="flex-1 text-sm font-medium">{error || message}</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-gray-400 transition hover:text-black"
        aria-label="Đóng thông báo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function HomePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [collections, setCollections] = useState([]);
  const [banners, setBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());
  const [newArrivalsPage, setNewArrivalsPage] = useState(0);
  const [bestSellersPage, setBestSellersPage] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [
          productResponse,
          variantResponse,
          bannerResponse,
          collectionResponse,
          wishlistResponse,
        ] = await Promise.all([
          apiRequest("/products?limit=100"),
          apiRequest("/product-variants?limit=1200"),
          apiRequest("/banners/active"),
          apiRequest("/collections?limit=6&isActive=true"),
          token
            ? apiRequest("/wishlists/me", { token })
            : Promise.resolve({ data: { items: [] } }),
        ]);

        setProducts(productResponse.data);
        setVariants(variantResponse.data);
        setBanners(bannerResponse.data || []);
        setCollections(collectionResponse.data || []);
        const wishlistIds = new Set(
          (wishlistResponse.data?.items || [])
            .map((item) => item.productId?._id)
            .filter(Boolean),
        );
        setWishlistProductIds(wishlistIds);
        setError("");
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  useEffect(() => {
    if (!message && !error) return undefined;
    const timer = setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, error]);

  const productsWithVariants = useMemo(
    () => attachVariantsToProducts(products, variants),
    [products, variants],
  );

  const newArrivals = useMemo(
    () =>
      [...productsWithVariants]
        .sort(
          (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
        )
        .slice(0, 12),
    [productsWithVariants],
  );

  const newArrivalsPageCount = Math.max(1, newArrivals.length - 3);
  const visibleNewArrivals = useMemo(() => {
    const start = newArrivalsPage;
    return newArrivals.slice(start, start + 4);
  }, [newArrivals, newArrivalsPage]);

  const bestSellers = useMemo(
    () =>
      [...productsWithVariants]
        .filter((product) => Number(product.soldCount || 0) > 0)
        .sort((left, right) => {
          const soldDiff =
            Number(right.soldCount || 0) - Number(left.soldCount || 0);
          if (soldDiff !== 0) return soldDiff;
          return (
            Number(right.totalReviews || 0) - Number(left.totalReviews || 0)
          );
        })
        .slice(0, 12),
    [productsWithVariants],
  );

  const bestSellersPageCount = Math.max(1, bestSellers.length - 3);
  const visibleBestSellers = useMemo(() => {
    const start = bestSellersPage;
    return bestSellers.slice(start, start + 4);
  }, [bestSellers, bestSellersPage]);

  const featuredCollections = useMemo(
    () => collections.slice(0, 3),
    [collections],
  );

  const productCollectionMap = useMemo(() => {
    const map = new Map();
    collections.forEach((collection) => {
      if (!collection?.isActive) return;
      (collection.products || []).forEach((item) => {
        const productId = item?._id || item;
        if (productId && !map.has(productId)) {
          map.set(productId, collection.name);
        }
      });
    });
    return map;
  }, [collections]);

  const withCollectionName = (product) => ({
    ...product,
    collectionName:
      productCollectionMap.get(product._id) || product.collectionName,
  });

  const handleWishlist = async (product, addedFrom = "home") => {
    if (!token) {
      navigate("/login");
      return;
    }

    const productId = product?._id;
    if (!productId) return;

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
        setMessage(`Đã bỏ ${product.name} khỏi danh sách yêu thích`);
      } else {
        await apiRequest("/wishlists/me", {
          method: "POST",
          token,
          body: {
            productId,
            addedFrom,
          },
        });
        setWishlistProductIds((current) => {
          const next = new Set(current);
          next.add(productId);
          return next;
        });
        setMessage(`Đã thêm ${product.name} vào danh sách yêu thích`);
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleAddToCart = async (product, variant) => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: variant._id,
          quantity: 1,
          source: "home",
        },
      });

      setMessage(`Đã thêm ${product.name} vào giỏ hàng`);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handlePrevBanner = () => {
    if (!banners.length) return;
    setActiveBannerIndex((prev) =>
      prev === 0 ? banners.length - 1 : prev - 1,
    );
  };

  const handleNextBanner = () => {
    if (!banners.length) return;
    setActiveBannerIndex((prev) =>
      prev === banners.length - 1 ? 0 : prev + 1,
    );
  };

  useEffect(() => {
    if (!banners.length || isHeroPaused) return;

    const timer = setInterval(() => {
      setActiveBannerIndex((prev) =>
        prev === banners.length - 1 ? 0 : prev + 1,
      );
    }, 6000);

    return () => clearInterval(timer);
  }, [banners, isHeroPaused]);

  useEffect(() => {
    if (newArrivalsPage >= newArrivalsPageCount) {
      setNewArrivalsPage(0);
    }
  }, [newArrivalsPage, newArrivalsPageCount]);

  useEffect(() => {
    if (bestSellersPage >= bestSellersPageCount) {
      setBestSellersPage(0);
    }
  }, [bestSellersPage, bestSellersPageCount]);

  useEffect(() => {
    if (activeBannerIndex >= banners.length && banners.length > 0) {
      setActiveBannerIndex(0);
    }
  }, [activeBannerIndex, banners.length]);

  const activeBanner = banners[activeBannerIndex] || null;
  const bannerLink = activeBanner?.collectionId?.slug
    ? `/collections/${activeBanner.collectionId.slug}`
    : "/collections";
  const bannerTitle =
    activeBanner?.title || activeBanner?.collectionId?.name || "Bộ sưu tập mới";

  return (
    <div className="bg-white">
      <Toast
        message={message}
        error={error}
        onClose={() => {
          setMessage("");
          setError("");
        }}
      />

      {/* Hero */}
      <section
        className="relative h-[min(78vh,720px)] min-h-[480px] overflow-hidden bg-neutral-900 text-white"
        onMouseEnter={() => setIsHeroPaused(true)}
        onMouseLeave={() => setIsHeroPaused(false)}
      >
        {activeBanner ? (
          <>
            <img
              src={activeBanner.imageUrl}
              alt={bannerTitle}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/20" />
            <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-end px-4 pb-16 pt-24 md:px-8 md:pb-20">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">
                Bộ sưu tập nổi bật
              </p>
              <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                {bannerTitle}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80 md:text-base">
                Khám phá phong cách mới nhất - thiết kế tinh gọn, chất liệu cao
                cấp, dễ phối mọi dịp.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={bannerLink}
                  className="inline-flex items-center gap-2 bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-gray-100"
                >
                  Khám phá ngay
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 border border-white/80 px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-black"
                >
                  Tất cả sản phẩm
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <img
              src="https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2071&auto=format&fit=crop"
              alt="Fashion hero"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
            <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-center px-4 md:px-8">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">
                Spring Summer 2026
              </p>
              <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                Thời trang tối giản,
                <br />
                phong cách của bạn
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
                Trải nghiệm mua sắm hiện đại với bộ sưu tập độc quyền - tinh tế,
                bền vững và dễ phối đồ hàng ngày.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-gray-100"
                >
                  Mua ngay
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={token ? "/recommendations" : "/login"}
                  className="inline-flex items-center gap-2 border border-white/80 px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-black"
                >
                  {token ? "Gợi ý cho bạn" : "Đăng nhập"}
                </Link>
              </div>
            </div>
          </>
        )}

        {banners.length > 1 ? (
          <>
            <button
              type="button"
              onClick={handlePrevBanner}
              className="absolute left-4 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 md:left-8"
              aria-label="Banner trước"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNextBanner}
              className="absolute right-4 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 md:right-8"
              aria-label="Banner sau"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
              {banners.map((banner, index) => (
                <button
                  key={banner._id}
                  type="button"
                  onClick={() => setActiveBannerIndex(index)}
                  className={`rounded-full transition-all ${
                    index === activeBannerIndex
                      ? "h-2.5 w-8 bg-white"
                      : "h-2.5 w-2.5 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Chuyển tới banner ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      {/* Trust bar */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-4 px-4 py-5 md:grid-cols-4 md:gap-6 md:px-8 md:py-6">
          {trustItems.map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black shadow-sm">
                <item.icon className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-black">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* Personalized Recommendations */}
      <section className="mx-auto max-w-[1440px] px-4 py-12 md:px-8 md:pb-16">
        {token ? (
          <RecommendationSection
            type="personalized"
            token={token}
            limit={12}
            onAddToWishlist={(item) =>
              handleWishlist(item, "home_personalized")
            }
            onAddToCart={handleAddToCart}
            wishlistProductIds={wishlistProductIds}
            showAIBadge={true}
          />
        ) : null}
      </section>

      {/* Category cards */}
      <section className="mx-auto max-w-[1440px] px-4 pb-12 md:px-8 md:pb-16">
        <SectionHeader
          eyebrow="Danh mục"
          title="Mua sắm theo phong cách"
          description="Chọn danh mục phù hợp với bạn - từ trang phục hàng ngày đến bộ sưu tập đặc biệt."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {categoryCards.map((item) => (
            <Link
              key={item.title}
              to={item.link}
              className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-sm md:min-h-[380px]"
            >
              <img
                src={item.image}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative z-10 p-6 text-white md:p-8">
                <h3 className="text-xl font-bold md:text-2xl">{item.title}</h3>
                <p className="mt-2 max-w-[90%] text-sm leading-relaxed text-white/80">
                  {item.copy}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                  Khám phá
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-16 px-4 pb-20 md:px-8 md:pb-24">
        {/* New arrivals */}
        <section>
          <SectionHeader
            eyebrow="Mới về"
            title="Sản phẩm mới"
            description="Những thiết kế mới nhất vừa được bổ sung - cập nhật tủ đồ của bạn."
            linkTo="/products?newArrivals=1"
          />
          {loading ? (
            <ProductGridSkeleton />
          ) : (
            <div className="group relative">
              {newArrivals.length > 4 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setNewArrivalsPage((prev) =>
                        prev === 0 ? newArrivalsPageCount - 1 : prev - 1,
                      )
                    }
                    className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:border-black md:-left-5"
                    aria-label="Xem sản phẩm mới trước"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewArrivalsPage((prev) =>
                        prev === newArrivalsPageCount - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:border-black md:-right-5"
                    aria-label="Xem sản phẩm mới tiếp theo"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {visibleNewArrivals.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={withCollectionName(product)}
                    onAddToWishlist={(item) => handleWishlist(item, "home")}
                    isWishlisted={wishlistProductIds.has(product._id)}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Featured collections */}
        {featuredCollections.length > 0 ? (
          <section>
            <SectionHeader
              eyebrow="Editorial"
              title="Bộ sưu tập nổi bật"
              description="Các câu chuyện thời trang được tuyển chọn theo mùa và phong cách riêng."
              linkTo="/collections"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
              {featuredCollections.map((collection, index) => (
                <Link
                  key={collection._id}
                  to={`/collections/${collection.slug || collection._id}`}
                  className="group relative min-h-[280px] overflow-hidden rounded-sm bg-gray-100 md:min-h-[360px]"
                >
                  {collection.coverImage ? (
                    <img
                      src={collection.coverImage}
                      alt={collection.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-neutral-200" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute left-4 top-4 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
                    <h3 className="text-lg font-bold md:text-xl">
                      {collection.name}
                    </h3>
                    {collection.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-white/75">
                        {collection.description}
                      </p>
                    ) : null}
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest">
                      Xem bộ sưu tập
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Best sellers */}
        <section>
          <SectionHeader
            eyebrow="Yêu thích"
            title="Bán chạy nhất"
            description="Những sản phẩm được khách hàng đánh giá và mua nhiều nhất."
            linkTo="/products?bestSeller=1"
          />
          {loading ? (
            <ProductGridSkeleton />
          ) : (
            <div className="group relative">
              {bestSellers.length > 4 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setBestSellersPage((prev) =>
                        prev === 0 ? bestSellersPageCount - 1 : prev - 1,
                      )
                    }
                    className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:border-black md:-left-5"
                    aria-label="Xem sản phẩm bán chạy trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBestSellersPage((prev) =>
                        prev === bestSellersPageCount - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center border border-gray-300 bg-white/90 text-black shadow-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:border-black md:-right-5"
                    aria-label="Xem sản phẩm bán chạy tiếp theo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {visibleBestSellers.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={withCollectionName(product)}
                    onAddToWishlist={(item) => handleWishlist(item, "home")}
                    isWishlisted={wishlistProductIds.has(product._id)}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Trending Products */}
        <RecommendationSection
          type="trending"
          limit={12}
          onAddToWishlist={
            token ? (item) => handleWishlist(item, "home_trending") : null
          }
          onAddToCart={token ? handleAddToCart : null}
          wishlistProductIds={wishlistProductIds}
        />

        {/* CTA banner */}
        <section className="relative overflow-hidden rounded-sm bg-neutral-900 px-6 py-14 text-center text-white md:px-12 md:py-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative z-10 mx-auto max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
              Thành viên FashionStore
            </p>
            <h2 className="mt-3 text-2xl font-bold md:text-3xl">
              Nhận gợi ý phối đồ thông minh
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Đăng nhập để hệ thống học sở thích của bạn và đề xuất sản phẩm phù
              hợp nhất.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {token ? (
                <Link
                  to="/recommendations"
                  className="inline-flex items-center gap-2 bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-gray-100"
                >
                  Xem gợi ý
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-gray-100"
                  >
                    Đăng ký ngay
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 border border-white/60 px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-black"
                  >
                    Đăng nhập
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
