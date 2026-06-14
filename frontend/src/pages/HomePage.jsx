import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
  GalleryVerticalEnd,
  PackagePlus,
  BookOpen
} from "lucide-react";
import ProductCard from "../components/ProductCard.jsx";
import RecommendationSection from "../components/RecommendationSection.jsx";
import BestSellersSection from "../components/BestSellersSection.jsx";
import CouponPopup from "../components/CouponPopup.jsx";
import CouponSection from "../components/CouponSection.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";
import { trackBehavior } from "../lib/tracking.js";
import { formatProductName } from "../lib/productName.js";
import toast from "react-hot-toast";

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
    copy: "Miễn phí đơn từ 999.000₫",
  },
  {
    icon: RotateCcw,
    title: "Đổi trả 30 ngày",
    copy: "Quy trình đơn giản, nhanh chóng",
  },
  {
    icon: ShieldCheck,
    title: "Thanh toán an toàn",
    copy: "COD, VNPay, PayPal",
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
  icon: Icon,
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <div className="mb-2 flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-gray-400" strokeWidth={2} />}
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
              {eyebrow}
            </p>
          </div>
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
      className={`fixed bottom-6 right-4 z-50 flex max-w-sm items-start gap-3 border px-4 py-3 shadow-lg md:right-8 ${error
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-green-200 bg-green-50 text-green-800"
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
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [collections, setCollections] = useState([]);
  const [banners, setBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());
  const [newArrivalsPage, setNewArrivalsPage] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

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
      } catch (loadError) {
        toast.error(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 700);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      toast.error("Vui lòng đăng nhập để thêm sản phẩm vào yêu thích.");
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
        toast.success(`Đã bỏ ${formatProductName(product.name)} khỏi danh sách yêu thích`);

        // Track remove_from_wishlist behavior
        trackBehavior(token, {
          actionType: "remove_from_wishlist",
          productId,
          source: addedFrom
        });
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
        toast.success(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);

        // Track add_to_wishlist behavior (đối xứng với remove_from_wishlist)
        trackBehavior(token, {
          actionType: "add_to_wishlist",
          productId,
          source: addedFrom,
          metadata: {
            categoryId: typeof product.categoryId === "object" ? product.categoryId?._id : product.categoryId,
            style: Array.isArray(product.style) ? product.style : (product.style ? [product.style] : []),
            occasion: Array.isArray(product.occasion) ? product.occasion : (product.occasion ? [product.occasion] : [])
          }
        });
      }
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const handleAddToCart = async (product, variant) => {
    if (!token) {
      toast.error("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.");
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

      toast.success(`Đã thêm ${formatProductName(product.name)} vào giỏ hàng`);
    } catch (requestError) {
      toast.error(requestError.message);
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
    if (activeBannerIndex >= banners.length && banners.length > 0) {
      setActiveBannerIndex(0);
    }
  }, [activeBannerIndex, banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || isHeroPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % banners.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [banners.length, isHeroPaused, activeBannerIndex]);

  const activeBanner = banners[activeBannerIndex] || null;
  const bannerLink = activeBanner?.collectionId?.slug
    ? `/collections/${activeBanner.collectionId.slug}`
    : "/collections";
  const bannerTitle =
    activeBanner?.title || activeBanner?.collectionId?.name || "Bộ sưu tập mới";

  return (
    <div className="bg-white">
      <CouponPopup />
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-black shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-black md:bottom-8 md:right-8 ${showBackToTop
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
          }`}
        aria-label="Trở về đầu trang"
      >
        <ArrowUp className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* Hero */}
      <section
        className="relative h-[85vh] min-h-[630px] overflow-hidden bg-neutral-900 text-white"
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-end px-6 pb-20 pt-24 md:px-12 md:pb-24">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.4em] text-white/80">
                Bộ sưu tập nổi bật
              </p>
              <h1 className="max-w-3xl text-4xl font-light leading-tight tracking-tight md:text-6xl lg:text-7xl">
                {bannerTitle}
              </h1>
              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/80 md:text-base">
                Khám phá phong cách mới nhất - thiết kế tinh gọn, chất liệu cao
                cấp, dễ phối mọi dịp.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to={bannerLink}
                  className="inline-flex items-center justify-center gap-2 bg-white px-10 py-4 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-gray-200"
                >
                  Khám phá ngay
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/products"
                  className="inline-flex items-center justify-center gap-2 border border-white/40 px-10 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black"
                >
                  Tất cả sản phẩm
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <img
              src="/images/bst.jpg"
              alt="Fashion hero"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-end px-6 pb-20 pt-24 md:px-12 md:pb-24">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.4em] text-white/80">
                Spring Summer 2026
              </p>
              <h1 className="max-w-3xl text-4xl font-light leading-tight tracking-tight md:text-6xl lg:text-7xl">
                Thời trang tối giản,<br />phong cách của bạn
              </h1>
              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/80 md:text-base">
                Trải nghiệm mua sắm hiện đại với bộ sưu tập độc quyền - tinh tế,
                bền vững và dễ phối đồ hàng ngày.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/products"
                  className="inline-flex items-center justify-center gap-2 bg-white px-10 py-4 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-gray-200"
                >
                  Mua ngay
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={token ? "/recommendations" : "/login"}
                  className="inline-flex items-center justify-center gap-2 border border-white/40 px-10 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black"
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
              className="absolute left-4 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center bg-black/10 text-white backdrop-blur-md transition hover:bg-black/30 md:left-8"
              aria-label="Banner trước"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={handleNextBanner}
              className="absolute right-4 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center bg-black/10 text-white backdrop-blur-md transition hover:bg-black/30 md:right-8"
              aria-label="Banner sau"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={1.5} />
            </button>
            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
              {banners.map((banner, index) => (
                <button
                  key={banner._id}
                  type="button"
                  onClick={() => setActiveBannerIndex(index)}
                  className={`rounded-full transition-all ${index === activeBannerIndex
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
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-y divide-gray-100 md:grid-cols-4 md:divide-y-0">
          {trustItems.map((item) => (
            <div key={item.title} className="flex flex-col items-center justify-center gap-3 p-6 text-center md:p-8">
              <item.icon className="h-6 w-6 text-black" strokeWidth={1} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-black">
                  {item.title}
                </p>
                <p className="mt-1.5 text-[13px] text-gray-500">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Personalized Recommendations */}
      {token ? (
        <section className="mx-auto max-w-[1440px] px-4 py-12 md:px-8 md:pb-16">

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
        </section>
      ) :
        (
          <section className="mt-12">

          </section>
        )}


      {/* Category cards */}
      <section className="mx-auto max-w-[1440px] px-4 pb-12 md:px-8 md:pb-16">
        <SectionHeader
          eyebrow="Danh mục"
          title="Mua sắm theo phong cách"
          description="Chọn danh mục phù hợp với bạn - từ trang phục hàng ngày đến bộ sưu tập đặc biệt."
          icon={GalleryVerticalEnd}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {categoryCards.map((item) => (
            <Link
              key={item.title}
              to={item.link}
              className="group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-none md:min-h-[400px]"
            >
              <img
                src={item.image}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="relative z-10 p-8 text-white">
                <h3 className="text-2xl font-light tracking-wide md:text-3xl">{item.title}</h3>
                <p className="mt-3 max-w-[90%] text-sm leading-relaxed text-white/80">
                  {item.copy}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 border-b border-white pb-1 text-[11px] font-bold uppercase tracking-widest transition-all group-hover:gap-3">
                  Khám phá
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-16 px-4 pb-4 md:px-8 md:pb-4">
        {/* New arrivals */}
        <section>
          <SectionHeader
            eyebrow="Mới về"
            title="Sản phẩm mới"
            description="Những thiết kế mới nhất vừa được bổ sung - cập nhật tủ đồ của bạn."
            linkTo="/products?newArrivals=1"
            icon={PackagePlus}
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
                    className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 grid h-12 w-12 place-items-center bg-white text-black shadow-lg opacity-0 transition-all duration-300 group-hover:opacity-100 md:-left-6"
                    aria-label="Xem sản phẩm mới trước"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewArrivalsPage((prev) =>
                        prev === newArrivalsPageCount - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 grid h-12 w-12 place-items-center bg-white text-black shadow-lg opacity-0 transition-all duration-300 group-hover:opacity-100 md:-right-6"
                    aria-label="Xem sản phẩm mới tiếp theo"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
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
              icon={BookOpen}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
              {featuredCollections.map((collection, index) => (
                <Link
                  key={collection._id}
                  to={`/collections/${collection.slug || collection._id}`}
                  className="group relative min-h-[350px] overflow-hidden bg-gray-100 md:min-h-[450px]"
                >
                  {collection.coverImage ? (
                    <img
                      src={collection.coverImage}
                      alt={collection.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-neutral-200" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute left-6 top-6 text-2xl font-light text-white/50">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
                    <h3 className="text-2xl font-light tracking-wide md:text-3xl">
                      {collection.name}
                    </h3>
                    {collection.description ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/80">
                        {collection.description}
                      </p>
                    ) : null}
                    <span className="mt-6 inline-flex items-center gap-2 border-b border-white pb-1 text-[11px] font-bold uppercase tracking-widest transition-all group-hover:gap-3">
                      Xem bộ sưu tập
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* BestSellers Section */}
        <BestSellersSection
          onAddToWishlist={(item) => handleWishlist(item, "home_bestseller")}
          onAddToCart={handleAddToCart}
          wishlistProductIds={wishlistProductIds}
        />

        {/* Coupon Section */}
        <CouponSection />

        {/* Trending Products */}
        <RecommendationSection
          type="trending"
          limit={12}
          onAddToWishlist={(item) => handleWishlist(item, "home_trending")}
          onAddToCart={handleAddToCart}
          wishlistProductIds={wishlistProductIds}
        />

        {/* CTA banner */}
        <section className="relative overflow-hidden bg-[#111] px-6 text-center text-white md:px-12 md:py-20">
          <div className="relative z-10 mx-auto max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/60">
              FashionStore
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight md:text-4xl">
              Gợi ý sản phẩm dành riêng cho bạn
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-white/80">
              Hệ thống học từ lịch sử xem và mua hàng của bạn để đề xuất sản phẩm phù
              hợp nhất.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {token ? (
                <Link
                  to="/recommendations"
                  className="inline-flex items-center gap-2 bg-white px-10 py-4 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-gray-200"
                >
                  Xem gợi ý
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 bg-white px-10 py-4 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-gray-200"
                  >
                    Đăng ký ngay
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 border border-white/40 px-10 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black"
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
