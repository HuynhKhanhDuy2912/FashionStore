import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";

const editCards = [
  {
    title: "THỜI TRANG NAM",
    copy: "Phom dáng thoải mái, tông màu nhã nhặn và những món đồ cơ bản linh hoạt.",
    tone: "bg-gray-100 text-black",
    link: "/products?gender=male",
  },
  {
    title: "THỜI TRANG NỮ",
    copy: "Đường nét mềm mại, layer thông minh và trang phục dạo phố thanh lịch.",
    tone: "bg-gray-200 text-black",
    link: "/products?gender=female",
  },
  {
    title: "BỘ SƯU TẬP",
    copy: "Khám phá các gợi ý phối đồ và lựa chọn cá nhân hóa từ dữ liệu của bạn.",
    tone: "bg-black text-white",
    link: "/recommendations",
  },
];

export default function HomePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [banners, setBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productResponse, variantResponse, bannerResponse] =
          await Promise.all([
            apiRequest("/products?limit=100"),
            apiRequest("/product-variants?limit=1200"),
            apiRequest("/banners/active"),
          ]);

        setProducts(productResponse.data);
        setVariants(variantResponse.data);
        setBanners(bannerResponse.data || []);
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!token) return;
      try {
        const response = await apiRequest("/recommendations/me", { token });
        setRecommendations(response.data.slice(0, 4));
      } catch (err) {
        console.error("Lỗi khi tải gợi ý:", err);
      }
    };
    loadRecommendations();
  }, [token]);

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
        .slice(0, 4),
    [productsWithVariants],
  );

  const bestSellers = useMemo(
    () =>
      [...productsWithVariants]
        .sort(
          (left, right) => (right.totalReviews || 0) - (left.totalReviews || 0),
        )
        .slice(0, 4),
    [productsWithVariants],
  );

  const handleWishlist = async (product, addedFrom = "home") => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      await apiRequest("/wishlists/me", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          addedFrom,
        },
      });

      setMessage(`Đã thêm ${product.name} vào danh sách yêu thích`);
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
    if (!banners.length) return;

    const timer = setInterval(() => {
      setActiveBannerIndex((prev) =>
        prev === banners.length - 1 ? 0 : prev + 1,
      );
    }, 5000);

    return () => clearInterval(timer);
  }, [banners]);

  useEffect(() => {
    if (activeBannerIndex >= banners.length && banners.length > 0) {
      setActiveBannerIndex(0);
    }
  }, [activeBannerIndex, banners.length]);

  const activeBanner = banners[activeBannerIndex] || null;

  return (
    <div className="pb-16">
      {/* Hero Banner Slider (Full bleed) */}
      <section className="relative h-[calc(100vh-64px)] min-h-[500px] overflow-hidden bg-black text-white mb-10">
        {activeBanner ? (
          <>
            <Link
              to={
                activeBanner.collectionId?.slug
                  ? `/collections/${activeBanner.collectionId.slug}`
                  : "/collections"
              }
              className="absolute inset-0 block"
              aria-label={
                activeBanner.title ||
                activeBanner.collectionId?.name ||
                "Banner bộ sưu tập"
              }
            >
              <img
                src={activeBanner.imageUrl}
                alt={
                  activeBanner.title ||
                  activeBanner.collectionId?.name ||
                  "Banner"
                }
                className="absolute inset-0 w-full h-full object-cover"
              />
            </Link>

            {banners.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={handlePrevBanner}
                  className="absolute left-4 top-1/2 z-20 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                  aria-label="Banner trước"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <button
                  type="button"
                  onClick={handleNextBanner}
                  className="absolute right-4 top-1/2 z-20 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                  aria-label="Banner sau"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
                  {banners.map((banner, index) => (
                    <button
                      key={banner._id}
                      type="button"
                      onClick={() => setActiveBannerIndex(index)}
                      className={`h-2.5 rounded-full transition-all ${index === activeBannerIndex ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`}
                      aria-label={`Chuyển tới banner ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <img
              src="https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2071&auto=format&fit=crop"
              alt="Hero background"
              className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
              <div className="max-w-4xl flex flex-col items-center mt-20">
                <span className="uppercase tracking-[0.3em] text-xs font-bold mb-6 block border border-white px-4 py-2 bg-black/30 backdrop-blur-sm">
                  SPRING SUMMER 2026
                </span>
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight tracking-tight uppercase">
                  SỰ TỐI GIẢN LÊN NGÔI
                </h2>
                <p className="text-lg text-white/80 mb-10 max-w-2xl leading-relaxed">
                  Khám phá trải nghiệm mua sắm thời trang hiện đại với bộ sưu
                  tập độc quyền, mang đậm dấu ấn cá nhân và sự tinh tế.
                </p>
                <div className="flex gap-4 flex-wrap justify-center">
                  <Link
                    className="px-10 py-4 bg-white text-black font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
                    to="/products"
                  >
                    MUA NGAY
                  </Link>
                  <Link
                    className="px-10 py-4 bg-transparent text-white border border-white font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-colors"
                    to="/recommendations"
                  >
                    GỢI Ý CHO BẠN
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
      
      {/* Featured Categories Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-1">
          {editCards.map((item) => (
            <article
              key={item.title}
              className={`relative h-[500px] p-10 flex flex-col justify-end overflow-hidden group ${item.tone}`}
            >
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4 uppercase tracking-wider">
                  {item.title}
                </h3>
                <p className="opacity-80 mb-8 leading-relaxed max-w-[90%] text-sm">
                  {item.copy}
                </p>
                <Link
                  to={item.link}
                  className="inline-block border-b-2 border-current pb-1 font-bold tracking-widest uppercase text-xs hover:opacity-50 transition-opacity"
                >
                  KHÁM PHÁ
                </Link>
              </div>
            </article>
          ))}
        </section>
        
        {message ? (
          <p className="text-black bg-gray-100 px-6 py-4 border-l-4 border-black font-medium">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-red-600 bg-red-50 px-6 py-4 border-l-4 border-red-600 font-medium">
            {error}
          </p>
        ) : null}
      <div className="mx-auto flex max-w-[1440px] flex-col gap-16 px-4 md:px-6 lg:px-8">
        
        {/* New Arrivals */}
        <section>
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4 border-b border-gray-200 pb-4 pt-4">
            <div>
              <h2 className="text-3xl font-extrabold tracking-widest text-black uppercase">
                SẢN PHẨM MỚI
              </h2>
            </div>
            <Link
              className="font-bold text-black hover:text-gray-500 transition-colors border-b-2 border-transparent hover:border-black pb-1 text-xs uppercase tracking-widest"
              to="/products"
            >
              XEM TẤT CẢ
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-[1px] bg-gray-200 md:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToWishlist={(item) => handleWishlist(item, "home")}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </section>

        {/* Large Featured Panels */}
        <section className="grid grid-cols-1 gap-1 md:grid-cols-2">
          <article className="p-12 flex flex-col items-center justify-center min-h-[600px] bg-black text-white relative overflow-hidden group text-center">
            <img
              src="https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=1974&auto=format&fit=crop"
              alt="Menswear"
              className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000"
            />
            <div className="relative z-10 max-w-md">
              <span className="uppercase tracking-[0.3em] text-xs font-bold text-white/70 mb-4 block">
                BỘ SƯU TẬP
              </span>
              <h3 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight uppercase tracking-wider">
                THỜI TRANG NAM
              </h3>
              <p className="text-white/80 mb-10 text-sm leading-relaxed">
                Trang phục thiết yếu hàng ngày mang đến sự cân bằng hoàn hảo
                giữa sự thoải mái và sang trọng.
              </p>
              <Link
                to="/products?gender=male"
                className="px-10 py-4 bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-colors inline-block"
              >
                MUA NGAY
              </Link>
            </div>
          </article>
          <article className="p-12 flex flex-col items-center justify-center min-h-[600px] bg-gray-100 text-black relative overflow-hidden group text-center">
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop"
              alt="Womenswear"
              className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000 grayscale"
            />
            <div className="relative z-10 max-w-md">
              <span className="uppercase tracking-[0.3em] text-xs font-bold text-black/70 mb-4 block">
                BỘ SƯU TẬP
              </span>
              <h3 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight uppercase tracking-wider">
                THỜI TRANG NỮ
              </h3>
              <p className="text-black/80 mb-10 text-sm leading-relaxed">
                Cập nhật tủ đồ của bạn từ trang phục công sở thanh lịch đến dạo
                phố sành điệu.
              </p>
              <Link
                to="/products?gender=female"
                className="px-10 py-4 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors inline-block"
              >
                MUA NGAY
              </Link>
            </div>
          </article>
        </section>

        {/* Best Sellers */}
        <section className="mt-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4 border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-3xl font-extrabold tracking-widest text-black uppercase">
                BÁN CHẠY NHẤT
              </h2>
            </div>
            <Link
              className="font-bold text-black hover:text-gray-500 transition-colors border-b-2 border-transparent hover:border-black pb-1 text-xs uppercase tracking-widest"
              to="/products"
            >
              XEM TẤT CẢ
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-[1px] bg-gray-200 md:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToWishlist={(item) => handleWishlist(item, "home")}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </section>

        {/* Features - Minimalist */}
        <section className="border-t border-b border-gray-200 py-16 grid grid-cols-1 md:grid-cols-3 gap-12 text-center mt-8">
          <div className="flex flex-col items-center">
            <span className="text-2xl mb-4 block">01</span>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-widest">
              GIAO HÀNG TOÀN QUỐC
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Miễn phí giao hàng cho tất cả đơn hàng từ 500,000đ trở lên.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl mb-4 block">02</span>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-widest">
              ĐỔI TRẢ DỄ DÀNG
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Hỗ trợ đổi trả trong vòng 30 ngày kể từ khi nhận hàng.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl mb-4 block">03</span>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-widest">
              HỖ TRỢ 24/7
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Đội ngũ chăm sóc khách hàng luôn sẵn sàng hỗ trợ bạn.
            </p>
          </div>
        </section>

        {/* Recommended for You */}
        {token && recommendations.length > 0 ? (
          <section className="mt-4">
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4 border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-widest text-black uppercase">
                  GỢI Ý CHO BẠN
                </h2>
              </div>
              <Link
                className="font-bold text-black hover:text-gray-500 transition-colors border-b-2 border-transparent hover:border-black pb-1 text-xs uppercase tracking-widest"
                to="/recommendations"
              >
                XEM TẤT CẢ
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-[1px] bg-gray-200 md:grid-cols-4">
              {recommendations.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onAddToWishlist={(item) => handleWishlist(item, "home")}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
