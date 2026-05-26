import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import ReviewModal from "../components/ReviewModal.jsx";
import ReviewsModal from "../components/ReviewsModal.jsx";
import ProductInfoModal from "../components/ProductInfoModal.jsx";
import RecommendationSection from "../components/RecommendationSection.jsx";
import BestSellersSection from "../components/BestSellersSection.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { getProductPath } from "../lib/slug.js";
import { sortSizes } from "../lib/sizes.js";
import { ChevronLeft, ChevronsRight, ChevronRight, Star, ZoomIn, ZoomOut, Plus, Ruler, ArrowLeft, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

const CHECKOUT_SELECTION_KEY = "fashionstore_checkout_cart_item_ids";

function isVideoMedia(url = "") {
  return /\/video\/upload\/|\.mp4($|\?)|\.webm($|\?)|\.mov($|\?)/i.test(url);
}

export default function ProductDetailPage() {
  const { productId: rawProductId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedColorParam = searchParams.get("color") || "";
  const { token } = useAuth();

  // Extract actual ObjectId from slug-id format
  const productId = rawProductId.includes('-')
    ? rawProductId.split('-').pop()
    : rawProductId;

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [productImages, setProductImages] = useState([]);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImage, setActiveImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewImageFiles, setReviewImageFiles] = useState([]);
  const [reviewVideoFiles, setReviewVideoFiles] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showProductInfoModal, setShowProductInfoModal] = useState(false);
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const [productResponse, wishlistResponse] = await Promise.all([
          apiRequest(`/products/${productId}`),
          token ? apiRequest("/wishlists/me", { token }) : Promise.resolve({ data: { items: [] } })
        ]);

        const currentProduct = productResponse.data;
        const canonicalPath = getProductPath(currentProduct, {
          color: selectedColorParam || undefined
        });

        if (window.location.pathname !== canonicalPath.split("?")[0]) {
          navigate(canonicalPath, { replace: true });
        }

        const [variantResponse, imgResponse] = await Promise.all([
          apiRequest(`/product-variants?productId=${currentProduct._id}&limit=100`),
          apiRequest(`/product-images?productId=${currentProduct._id}&limit=50`)
        ]);

        const currentVariants = variantResponse.data || [];
        const pImages = imgResponse.data || [];

        setProduct(currentProduct);
        setVariants(currentVariants);
        setProductImages(pImages);

        // Set wishlist
        const wishlistIds = new Set((wishlistResponse.data?.items || []).map((item) => item.productId?._id).filter(Boolean));
        setWishlistProductIds(wishlistIds);

        if (currentVariants.length > 0) {
          const uniqueColors = [...new Set(currentVariants.map(v => v.color))];
          const initialColor = selectedColorParam;
          const colorToSet = initialColor && uniqueColors.includes(initialColor) ? initialColor : uniqueColors[0];

          setSelectedColor(colorToSet);
          const sizesForColor = sortSizes(currentVariants.filter(v => v.color === colorToSet).map(v => v.size));
          setSelectedSize(sizesForColor[0]);

          const imgsForColor = pImages.filter(i => i.color === colorToSet).map(i => i.imageUrl);
          const variantImg = currentVariants.find(v => v.color === colorToSet && v.image)?.image;

          if (variantImg) setActiveImage(variantImg);
          else if (imgsForColor.length > 0) setActiveImage(imgsForColor[0]);
          else {
            const mainGalleryImg = pImages.find(i => i.isMain);
            setActiveImage(mainGalleryImg?.imageUrl || pImages[0]?.imageUrl || currentProduct.images?.[0] || currentProduct.videos?.[0] || "");
          }
        } else {
          const mainGalleryImg = pImages.find(i => i.isMain);
          setActiveImage(mainGalleryImg?.imageUrl || pImages[0]?.imageUrl || currentProduct.images?.[0] || currentProduct.videos?.[0] || "");
        }

        const reviewsResponse = await apiRequest(`/reviews?productId=${currentProduct._id}&limit=50`);
        setReviews(reviewsResponse.data || []);
      } catch (e) {
        setError(e.message);
      }
    };

    loadProduct();
    setQuantity(1);
    setError("");
    window.scrollTo(0, 0);
  }, [navigate, productId, selectedColorParam]);

  useEffect(() => {
    if (!product || searchParams.get("review") !== "true" || !token) return;

    handleOpenReviewForm();
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("review");
    setSearchParams(newParams, { replace: true });
  }, [product, searchParams, setSearchParams, token]);

  const selectedVariant = useMemo(
    () => variants.find(v => v.color === selectedColor && v.size === selectedSize) || variants[0],
    [selectedColor, selectedSize, variants]
  );

  const availableColors = useMemo(() => [...new Set(variants.map(v => v.color))], [variants]);
  const availableSizes = useMemo(
    () => sortSizes([...new Set(variants.filter(v => v.color === selectedColor).map(v => v.size))]),
    [variants, selectedColor]
  );

  const galleryImages = useMemo(() => {
    // Lấy ảnh gallery: chỉ ảnh có màu đúng với selectedColor, HOẶC ảnh không có màu (!i.color)
    const imgsForColor = productImages
      .filter(i => i.color === selectedColor)
      .map(i => i.imageUrl);

    // Lấy ảnh của biến thể màu hiện tại
    const variantImage = variants.find(v => v.color === selectedColor && v.image)?.image;

    // Lấy ảnh chung (không có màu)
    const uncoloredImages = productImages
      .filter(i => !i.color)
      .map(i => i.imageUrl);

    const all = [
      variantImage,
      ...imgsForColor,
      ...uncoloredImages,
      ...(product?.videos || []),
    ].filter(Boolean);

    // Chỉ dùng ảnh gốc của sản phẩm (thường là mảng rỗng hoặc ảnh chính) nếu không có ảnh nào khác
    if (all.length > 0) return [...new Set(all)];
    return [...new Set(product?.images || [])].filter(Boolean);
  }, [product, variants, productImages, selectedColor]);

  const handleColorChange = (color) => {
    setSelectedColor(color);
    const sizesForColor = sortSizes(variants.filter(v => v.color === color).map(v => v.size));
    if (!sizesForColor.includes(selectedSize)) setSelectedSize(sizesForColor[0]);

    const imgsForColor = productImages.filter(i => i.color === color).map(i => i.imageUrl);
    const variantImg = variants.find(v => v.color === color && v.image)?.image;

    if (variantImg) setActiveImage(variantImg);
    else if (imgsForColor.length > 0) setActiveImage(imgsForColor[0]);
    else if (product?.videos?.[0]) setActiveImage(product.videos[0]);
  };

  const activeIndex = galleryImages.indexOf(activeImage);
  const goPrev = () => setActiveImage(galleryImages[(activeIndex - 1 + galleryImages.length) % galleryImages.length]);
  const goNext = () => setActiveImage(galleryImages[(activeIndex + 1) % galleryImages.length]);
  const activeMediaIsVideo = isVideoMedia(activeImage);


  const handleAddToCart = async () => {
    if (!selectedVariant) return;

    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: selectedVariant._id,
          quantity,
          source: "product_page"
        }
      });

      toast.success("Đã thêm sản phẩm vào giỏ hàng!", {
        duration: 3000
      });

    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleBuyNow = async () => {
    if (!selectedVariant) return;
    try {
      const cartResponse = await apiRequest("/carts/me", { token });
      const existingItem = cartResponse.data?.items?.find(
        (item) => item.variantId?._id === selectedVariant._id
      );
      const response = existingItem
        ? await apiRequest(`/carts/me/items/${existingItem._id}`, {
            method: "PUT",
            token,
            body: { quantity }
          })
        : await apiRequest("/carts/me/items", {
            method: "POST",
            token,
            body: { productId: product._id, variantId: selectedVariant._id, quantity, source: "buy_now" }
          });

      const cartItemId = response.data?._id;
      if (cartItemId) {
        const selectedItemIds = [cartItemId];
        sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(selectedItemIds));
        localStorage.removeItem(CHECKOUT_SELECTION_KEY);
        navigate("/checkout", { state: { selectedItemIds } });
      } else {
        sessionStorage.removeItem(CHECKOUT_SELECTION_KEY);
        localStorage.removeItem(CHECKOUT_SELECTION_KEY);
        navigate("/checkout");
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleWishlist = async (product, addedFrom = "product_detail") => {
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
        toast.success(`Đã bỏ ${product.name} khỏi danh sách yêu thích`);
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
        toast.success(`Đã thêm ${product.name} vào danh sách yêu thích`);
      }
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const handleOpenReviewForm = async () => {
    if (!token) {
      toast.error("Vui lòng đăng nhập để đánh giá sản phẩm.");
      return;
    }

    try {
      const orderIdFromQuery = searchParams.get("orderId") || "";

      if (orderIdFromQuery) {
        setReviewOrderId(orderIdFromQuery);
        setShowReviewForm(true);
        return;
      }

      const response = await apiRequest(`/reviews/eligibility/${product._id}`, { token });

      if (!response.data?.eligible) {
        toast.error(response.message || "Bạn cần mua sản phẩm này trước khi đánh giá.");
        return;
      }

      setReviewOrderId(response.data?.orderId || "");
      setShowReviewForm(true);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    setReviewSubmitting(true);

    try {
      const imageUrls = [];
      const videoUrls = [];

      // Upload images
      for (const file of reviewImageFiles) {
        const formData = new FormData();
        formData.append("image", file);
        const uploadResponse = await apiRequest("/upload", {
          method: "POST",
          token,
          body: formData,
          isFormData: true
        });
        imageUrls.push(uploadResponse.imageUrl || uploadResponse.mediaUrl);
      }

      // Upload videos
      for (const file of reviewVideoFiles) {
        const formData = new FormData();
        formData.append("image", file);
        const uploadResponse = await apiRequest("/upload", {
          method: "POST",
          token,
          body: formData,
          isFormData: true
        });
        videoUrls.push(uploadResponse.imageUrl || uploadResponse.mediaUrl);
      }

      if (!reviewOrderId) {
        throw new Error("Không xác định được đơn hàng để đánh giá");
      }

      await apiRequest("/reviews", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          orderId: reviewOrderId,
          rating: reviewRating,
          comment: reviewComment,
          imageUrls,
          videoUrls
        }
      });

      const [refreshedProduct, reviewsResponse] = await Promise.all([
        apiRequest(`/products/${product._id}`),
        apiRequest(`/reviews?productId=${product._id}&limit=50`)
      ]);

      setProduct(refreshedProduct.data);
      setReviews(reviewsResponse.data || []);
      setShowReviewForm(false);
      setReviewOrderId("");
      setReviewRating(5);
      setReviewComment("");
      setReviewImageFiles([]);
      setReviewVideoFiles([]);
      toast.success("Cảm ơn bạn đã đánh giá sản phẩm!");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!product) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">{error || "Đang tải sản phẩm..."}</p>
        </div>
      </section>
    );
  }

  const averageRating = Number(product.averageRating || 0);
  const totalReviews = Number(product.totalReviews || 0);
  const roundedRating = Math.round(averageRating);
  const soldCount = Number(product.soldCount || 0);


  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 py-4 px-6">
        <Link to="/" className="hover:text-black">TRANG CHỦ</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-black">SẢN PHẨM</Link>
        <span>/</span>
        <span className="text-black truncate max-w-[200px]">{product.name}</span>
      </nav>

      {/* ══ 3-COLUMN LAYOUT ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_420px] gap-0 min-h-[80vh]">

        {/* ── Cột 1: Sidebar trái ── */}
        <aside className="hidden lg:flex flex-col justify-end px-4 w-full max-w-[320px]">

          {/* Wrapper */}
          <div className="border border-gray-200 bg-white">

            {/* ================= REVIEW ================= */}
            <details className="group" open>
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">

                <span className="text-[13px] font-bold uppercase tracking-wide text-black">
                  Đánh giá
                </span>

                <span className="text-black transition-transform duration-300 group-open:rotate-45">
                  <Plus size={18} strokeWidth={1.5} />
                </span>
              </summary>

              <div className="px-6 py-5">

                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star
                      key={i}
                      size={13}
                      className={
                        i <= roundedRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }
                    />
                  ))}

                  <span className="ml-1 text-xs text-gray-500">
                    ({totalReviews})
                  </span>
                </div>

                {totalReviews > 0 ? (
                  <p className="text-[13px] text-gray-500 leading-6">
                    <span className="font-medium text-black">
                      {averageRating.toFixed(1)}/5
                    </span>{" "}
                    từ {totalReviews} lượt đánh giá
                  </p>
                ) : (
                  <p className="text-[13px] text-gray-500 leading-6">
                    Chưa có đánh giá nào
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setShowReviewsModal(true)}
                  className="mt-3 text-[14px] font-bold tracking-wide underline underline-offset-4 hover:text-gray-600 transition cursor-pointer bg-transparent border-none p-0"
                >
                  Xem tất cả đánh giá
                </button>
              </div>
            </details>

            {/* ================= PRODUCT INFO ================= */}
            <button
              type="button"
              onClick={() => setShowProductInfoModal(true)}
              className="w-full border-t border-gray-200 bg-transparent px-6 py-4 text-left"
            >
              <span className="flex items-center justify-between">
                <span className="text-[13px] font-bold uppercase tracking-wide text-[#c58b45]">
                  Thông tin sản phẩm
                </span>
                <span className="text-[#c58b45]">
                  <ChevronsRight size={18} strokeWidth={1.8} />
                </span>
              </span>
            </button>

            {/* ================= FAQ ================= */}
            <details className="group border-t border-gray-200">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">

                <span className="text-[13px] font-bold uppercase tracking-wide text-black">
                  Các câu hỏi thường gặp
                </span>

                <span className="text-black transition-transform duration-300 group-open:rotate-45">
                  <Plus size={18} strokeWidth={1.5} />
                </span>
              </summary>

              <div className="px-6 py-2 text-[13px] text-gray-600">

                <div>
                  <p className="font-semibold text-black">
                    Giao hàng
                  </p>

                  <p>
                    Miễn phí đơn hàng từ 500.000đ.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-black mt-2">
                    Đổi trả
                  </p>

                  <p>
                    Hỗ trợ đổi trả trong vòng 30 ngày.
                  </p>
                </div>

              </div>
            </details>

            {/* ================= SHIPPING ================= */}
            <details className="group border-t border-gray-200">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">

                <span className="text-[13px] font-bold uppercase tracking-wide text-black">
                  Giao hàng & đổi trả
                </span>

                <span className="text-black transition-transform duration-300 group-open:rotate-45">
                  <Plus size={18} strokeWidth={1.5} />
                </span>
              </summary>

              <div className="px-6 py-2 text-[13px] text-gray-600">

                <p className="mb-3" >
                  Miễn phí giao hàng toàn quốc cho đơn từ 500.000đ.
                </p>

                <p className="mb-3">
                  Hỗ trợ đổi trả trong vòng 30 ngày kể từ ngày nhận hàng.
                </p>

                <p>
                  Sản phẩm đổi trả cần còn nguyên tem và chưa qua sử dụng.
                </p>

              </div>
            </details>

          </div>
        </aside>

        {/* ── Cột 2: Ảnh sản phẩm ── */}
        <div className="relative flex pl-1">
          {/* Thumbnail strip dọc bên trái */}
          {galleryImages.length > 1 && (
            <div className="hidden lg:flex flex-col gap-2 p-3 w-[80px] shrink-0">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`w-full aspect-square border-2 overflow-hidden transition-all cursor-pointer p-0 bg-transparent ${activeImage === img ? "border-black" : "border-transparent opacity-40 hover:opacity-80"
                    }`}
                >
                  {isVideoMedia(img) ? (
                    <video src={img} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Ảnh chính */}
          <div
            className="flex-1 relative bg-gray-50 overflow-hidden group flex items-center justify-center"
            style={{ minHeight: "600px" }}
          >
            {activeImage && activeMediaIsVideo ? (
              <video
                key={activeImage}
                src={activeImage}
                className="max-w-full max-h-[78vh] object-contain"
                autoPlay
                muted
                controls
                playsInline
              />
            ) : activeImage ? (
              <img
                key={activeImage}
                src={activeImage}
                alt={product.name}
                className={`max-w-full max-h-[78vh] object-contain transition-transform duration-300 ${isZoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
                  }`}
                onClick={() => setIsZoomed(z => !z)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">Chưa có ảnh</div>
            )}

            {/* Zoom icon hint */}
            {!activeMediaIsVideo && (
              <button
                onClick={() => setIsZoomed(z => !z)}
                className="absolute bottom-4 right-4 w-9 h-9 bg-white/80 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-gray-200 shadow-sm"
              >
                {isZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
              </button>
            )}

            {/* Arrows */}
            {galleryImages.length > 1 && (
              <>
                <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none shadow-md">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none shadow-md">
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Dots mobile */}
            {galleryImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 lg:hidden">
                {galleryImages.map((img, idx) => (
                  <button key={idx} onClick={() => setActiveImage(img)}
                    className={`h-1.5 rounded-full border-none cursor-pointer transition-all ${activeImage === img ? "w-4 bg-black" : "w-1.5 bg-black/30"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Cột 3: Thông tin + Mua ── */}
        <div className="border border-gray-200 bg-white h-fit p-6 lg:p-8 flex flex-col gap-5 self-start ms-5">

          {/* Tên sản phẩm */}
          <div>
            <h1 className="text-2xl font-bold text-black leading-tight mb-1">
              {product.name}
            </h1>
            
            <p className="text-[12px] text-gray-400 uppercase tracking-widest">
              SKU: {product._id.slice(-6).toUpperCase()}
            </p>
          </div>

          {/* Giá */}
          {(() => {
            const basePrice = product.price;
            const adjustment = selectedVariant?.priceAdjustment || 0;
            const variantPrice = basePrice + adjustment;
            const productDiscount = product.discount || 0;
            const variantDiscount = selectedVariant?.discount;
            const effectiveDiscount = (variantDiscount !== null && variantDiscount !== undefined)
              ? variantDiscount
              : productDiscount;
            const discounted = effectiveDiscount > 0
              ? Math.round(variantPrice * (1 - effectiveDiscount / 100))
              : null;
            const displayPrice = discounted || variantPrice;

            return (
              <div className="py-3 border-t border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-extrabold text-black">
                    {displayPrice.toLocaleString("vi-VN")}₫
                  </span>
                  {discounted && (
                    <>
                      <span className="text-sm text-gray-400 line-through">
                        {variantPrice.toLocaleString("vi-VN")}₫
                      </span>
                      <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5">
                        -{effectiveDiscount}%
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {soldCount.toLocaleString("vi-VN")} sản phẩm đã bán
                </p>
              </div>
            );
          })()}

          <div className="lg:hidden border-b border-gray-100 pb-4">
            <div className="mb-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={14} className={i <= roundedRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
              ))}
              <span className="ml-1 text-xs text-gray-500">({totalReviews})</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleOpenReviewForm}
                className="border-none bg-transparent p-0 text-xs font-medium text-black underline"
              >
                Viết đánh giá sản phẩm
              </button>
              <button
                type="button"
                onClick={() => setShowProductInfoModal(true)}
                className="border-none bg-transparent p-0 text-xs font-medium text-[#c58b45] underline"
              >
                Thông tin sản phẩm
              </button>
            </div>
          </div>

          {/* Màu sắc */}
          {availableColors.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 text-black">
                {selectedColor}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableColors.map(color => {
                  const colorVariants = variants.filter(v => v.color === color);
                  const isColorOutOfStock = colorVariants.length > 0 && colorVariants.every(v => Number(v.stock || 0) === 0);
                  const v = colorVariants.find(v => v.image) || colorVariants[0];

                  return (
                    <button
                      key={color}
                      title={isColorOutOfStock ? `${color} - Hết hàng` : color}
                      onClick={() => handleColorChange(color)}
                      className={`w-14 h-[60px] border-2 overflow-hidden transition-all cursor-pointer p-0 bg-transparent relative ${color === selectedColor ? "border-black" : "border-gray-200 hover:border-gray-400"
                        } ${isColorOutOfStock ? "opacity-45" : "opacity-100"}`}
                    >
                      {v?.image
                        ? <img src={v.image} alt={color} className="w-full h-full object-cover" />
                        : <span className="text-[9px] uppercase tracking-wider flex items-center justify-center w-full h-full bg-gray-100 px-1 text-center leading-tight">{color}</span>
                      }

                      {isColorOutOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                          <div className="w-[150%] h-[1.5px] bg-gray-700 transform -rotate-45"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kích thước */}
          {availableSizes.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-black">KÍCH THƯỚC</p>
                <button className="text-[13px] text-black flex items-center border-none bg-transparent cursor-pointer transition-transform duration-300 hover:scale-105 origin-left">
                  <Ruler className="-rotate-[15deg] mr-1" size={13} strokeWidth={1.7} />
                  Hướng dẫn chọn size
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map(size => {
                  const variant = variants.find(v => v.color === selectedColor && v.size === size);
                  const isOutOfStock = variant?.stock === 0;

                  return (
                    <button
                      key={size}
                      onClick={() => !isOutOfStock && setSelectedSize(size)}
                      disabled={isOutOfStock}
                      className={`h-10 min-w-[44px] px-3 border text-xs font-bold uppercase tracking-wider transition-all relative ${isOutOfStock
                        ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                        : size === selectedSize
                          ? "border-black bg-black text-white cursor-pointer"
                          : "border-gray-300 bg-white text-black hover:border-black cursor-pointer"
                        }`}
                    >
                      {size}
                      {isOutOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                          <div className="w-[140%] h-[1px] bg-gray-400 transform -rotate-45"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Số lượng */}
          <div className="border-b border-gray-300 pt-4 pb-2">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-black">SỐ LƯỢNG</p>
              {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
                <span className="text-[12px] font-bold tracking-wide">
                  Chỉ còn {selectedVariant.stock} sản phẩm
                </span>
              )}
            </div>
            <div className="inline-flex items-center border border-gray-300 h-11">
              <button disabled={selectedVariant?.stock === 0} className="px-4 text-lg hover:bg-gray-100 h-full cursor-pointer border-none bg-transparent disabled:opacity-50" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
              <span className="px-5 text-sm font-bold min-w-[3rem] text-center border-l border-r border-gray-300 h-full flex items-center justify-center">{selectedVariant?.stock === 0 ? 0 : quantity}</span>
              <button disabled={selectedVariant?.stock === 0 || quantity >= selectedVariant?.stock} className="px-4 text-lg hover:bg-gray-100 h-full cursor-pointer border-none bg-transparent disabled:opacity-50" onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
          </div>

          {/* Nút mua */}
          {token ? (
            <div className="flex flex-col gap-3 mt-2">
              <button
                onClick={handleAddToCart}
                disabled={!selectedVariant || selectedVariant.stock === 0}
                className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors cursor-pointer border-none text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!selectedVariant || selectedVariant.stock === 0 ? "HẾT HÀNG" : "THÊM VÀO GIỎ HÀNG"}
              </button>
              {selectedVariant?.stock > 0 && (
                <button
                  onClick={handleBuyNow}
                  className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-gray-100 transition-colors cursor-pointer border border-black text-center"
                >
                  MUA NGAY
                </button>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors text-center block mt-2"
            >
              ĐĂNG NHẬP ĐỂ MUA HÀNG
            </Link>
          )}
        </div>
      </div>

      {/* Similar products */}
      <div className="mx-auto max-w-[1440px] px-4 py-12 md:px-8 md:py-16">
        <RecommendationSection
          type="similar"
          productId={productId}
          token={token}
          limit={12}
          onAddToWishlist={token ? (item) => handleWishlist(item, "product_detail_similar") : null}
          onAddToCart={token ? async (product, variant) => {
            try {
              await apiRequest("/carts/me/items", {
                method: "POST",
                token,
                body: {
                  productId: product._id,
                  variantId: variant._id,
                  quantity: 1,
                  source: "product_detail_similar"
                }
              });
              toast.success(`Đã thêm ${product.name} vào giỏ hàng`);
            } catch (err) {
              toast.error(err.message);
            }
          } : null}
          wishlistProductIds={wishlistProductIds}
        />
      </div>


      {/* Bán chạy nhất */}
      <BestSellersSection
        excludeProductId={productId}
        className="mx-auto max-w-[1440px] px-4 pb-12 md:px-8 md:pb-16"
        onAddToWishlist={token ? (item) => handleWishlist(item, "product_detail_bestseller") : null}
        onAddToCart={token ? async (prod, variant) => {
          try {
            await apiRequest("/carts/me/items", {
              method: "POST",
              token,
              body: {
                productId: prod._id,
                variantId: variant._id,
                quantity: 1,
                source: "product_detail_bestseller"
              }
            });
            toast.success(`Đã thêm ${prod.name} vào giỏ hàng`);
          } catch (err) {
            toast.error(err.message);
          }
        } : null}
        wishlistProductIds={wishlistProductIds}
      />

      <ProductInfoModal
        open={showProductInfoModal}
        onClose={() => setShowProductInfoModal(false)}
        product={product}
      />

      <ReviewsModal
        open={showReviewsModal}
        onClose={() => setShowReviewsModal(false)}
        reviews={reviews}
        averageRating={averageRating}
        totalReviews={totalReviews}
        onWriteReview={() => {
          setShowReviewsModal(false);
          handleOpenReviewForm();
        }}
      />

      <ReviewModal
        open={showReviewForm}
        onClose={() => {
          setShowReviewForm(false);
          setReviewOrderId("");
        }}
        onSubmit={handleSubmitReview}
        submitting={reviewSubmitting}
        productName={product.name}
        productSku={product._id.slice(-6).toUpperCase()}
        imageUrl={activeImage}
        rating={reviewRating}
        onRatingChange={setReviewRating}
        comment={reviewComment}
        onCommentChange={setReviewComment}
        selectedImages={reviewImageFiles}
        selectedVideos={reviewVideoFiles}
        onImageFilesChange={(files) => setReviewImageFiles(prev => [...prev, ...files])}
        onVideoFilesChange={(files) => setReviewVideoFiles(prev => [...prev, ...files])}
        onRemoveSelectedImage={(index) => setReviewImageFiles(prev => prev.filter((_, i) => i !== index))}
        onRemoveSelectedVideo={(index) => setReviewVideoFiles(prev => prev.filter((_, i) => i !== index))}
      />
    </div>
  );
}
