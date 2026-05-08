import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";
import { ChevronLeft, ChevronRight, Star, ZoomIn } from "lucide-react";

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();

  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [allVariants, setAllVariants] = useState([]);
  const [variants, setVariants] = useState([]);
  const [productImages, setProductImages] = useState([]);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImage, setActiveImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const [productResponse, productsResponse, variantResponse, imgResponse] = await Promise.all([
          apiRequest(`/products/${productId}`),
          apiRequest("/products?limit=100"),
          apiRequest(`/product-variants?productId=${productId}&limit=100`),
          apiRequest(`/product-images?productId=${productId}&limit=50`)
        ]);

        const currentProduct = productResponse.data;
        const currentVariants = variantResponse.data || [];
        const pImages = imgResponse.data || [];

        setProduct(currentProduct);
        setAllProducts(productsResponse.data);
        setAllVariants(variantResponse.data);
        setVariants(currentVariants);
        setProductImages(pImages);

        if (currentVariants.length > 0) {
          const uniqueColors = [...new Set(currentVariants.map(v => v.color))];
          const initialColor = searchParams.get("color");
          const colorToSet = initialColor && uniqueColors.includes(initialColor) ? initialColor : uniqueColors[0];
          
          setSelectedColor(colorToSet);
          const sizesForColor = currentVariants.filter(v => v.color === colorToSet).map(v => v.size);
          setSelectedSize(sizesForColor[0]);
          
          const imgsForColor = pImages.filter(i => i.color === colorToSet).map(i => i.imageUrl);
          const variantImg = currentVariants.find(v => v.color === colorToSet)?.image;
          
          if (imgsForColor.length > 0) setActiveImage(imgsForColor[0]);
          else if (variantImg) setActiveImage(variantImg);
          else {
            const mainGalleryImg = pImages.find(i => i.isMain);
            setActiveImage(mainGalleryImg?.imageUrl || pImages[0]?.imageUrl || currentProduct.images?.[0] || "");
          }
        } else {
          const mainGalleryImg = pImages.find(i => i.isMain);
          setActiveImage(mainGalleryImg?.imageUrl || pImages[0]?.imageUrl || currentProduct.images?.[0] || "");
        }
      } catch (e) {
        setError(e.message);
      }
    };

    loadProduct();
    setQuantity(1);
    setMessage("");
    setError("");
    window.scrollTo(0, 0);
  }, [productId]);

  const selectedVariant = useMemo(
    () => variants.find(v => v.color === selectedColor && v.size === selectedSize) || variants[0],
    [selectedColor, selectedSize, variants]
  );

  const availableColors = useMemo(() => [...new Set(variants.map(v => v.color))], [variants]);
  const availableSizes = useMemo(
    () => [...new Set(variants.filter(v => v.color === selectedColor).map(v => v.size))],
    [variants, selectedColor]
  );

  const galleryImages = useMemo(() => {
    // Lấy ảnh gallery: chỉ ảnh có màu đúng với selectedColor, HOẶC ảnh không có màu (!i.color)
    const imgsForColor = productImages
      .filter(i => i.color === selectedColor)
      .map(i => i.imageUrl);
    
    // Lấy ảnh của biến thể màu hiện tại
    const variantImage = variants.find(v => v.color === selectedColor)?.image;

    // Lấy ảnh chung (không có màu)
    const uncoloredImages = productImages
      .filter(i => !i.color)
      .map(i => i.imageUrl);

    const all = [
      ...imgsForColor,
      ...uncoloredImages,
      variantImage
    ].filter(Boolean);

    // Chỉ dùng ảnh gốc của sản phẩm (thường là mảng rỗng hoặc ảnh chính) nếu không có ảnh nào khác
    if (all.length > 0) return [...new Set(all)];
    return [...new Set(product?.images || [])].filter(Boolean);
  }, [product, variants, productImages, selectedColor]);

  const handleColorChange = (color) => {
    setSelectedColor(color);
    const sizesForColor = variants.filter(v => v.color === color).map(v => v.size);
    if (!sizesForColor.includes(selectedSize)) setSelectedSize(sizesForColor[0]);
    
    // Khi đổi màu, ưu tiên lấy ảnh đầu tiên của gallery màu đó, nếu không có mới lấy ảnh biến thể
    const imgsForColor = productImages.filter(i => i.color === color).map(i => i.imageUrl);
    const variantImg = variants.find(v => v.color === color)?.image;
    
    if (imgsForColor.length > 0) setActiveImage(imgsForColor[0]);
    else if (variantImg) setActiveImage(variantImg);
  };

  const activeIndex = galleryImages.indexOf(activeImage);
  const goPrev = () => setActiveImage(galleryImages[(activeIndex - 1 + galleryImages.length) % galleryImages.length]);
  const goNext = () => setActiveImage(galleryImages[(activeIndex + 1) % galleryImages.length]);

  const relatedProducts = useMemo(() =>
    allProducts.filter(i => i._id !== productId && product &&
      (i.style === product.style || i.gender === product.gender)).slice(0, 4),
    [allProducts, product, productId]
  );
  const relatedWithVariants = useMemo(() =>
    attachVariantsToProducts(relatedProducts, allVariants),
    [relatedProducts, allVariants]
  );

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    try {
      await apiRequest("/carts/me/items", {
        method: "POST", token,
        body: { productId: product._id, variantId: selectedVariant._id, quantity, source: "product_page" }
      });
      setMessage("Đã thêm vào giỏ hàng!");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) { setError(e.message); }
  };

  const handleBuyNow = async () => {
    if (!selectedVariant) return;
    try {
      await apiRequest("/carts/me/items", {
        method: "POST", token,
        body: { productId: product._id, variantId: selectedVariant._id, quantity, source: "buy_now" }
      });
      navigate("/checkout");
    } catch (e) { setError(e.message); }
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

  const discountedPrice = product.discount > 0
    ? Math.round(product.price * (1 - product.discount / 100))
    : null;

  const finalPrice = discountedPrice || product.price;

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
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_380px] gap-0 min-h-[80vh]">

        {/* ── Cột 1: Sidebar trái ── */}
        <aside className="hidden lg:block border-r border-gray-100 p-6 sticky top-20 self-start">
          {/* Đánh giá */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-widest">ĐÁNH GIÁ</h3>
            </div>
            <div className="flex items-center gap-1 mb-2">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={12} className={i <= 4 ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
              ))}
              <span className="text-xs text-gray-500 ml-1">(1)</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-black">T*** Cao</strong> | Sản phẩm mặc mát, đúng màu như mô tả.
            </p>
            <button className="text-xs text-black underline mt-2 font-medium cursor-pointer bg-transparent border-none p-0">Đọc thêm</button>
          </div>

          {/* Thông tin sản phẩm accordion */}
          <details className="mb-3 group" open>
            <summary className="flex justify-between items-center py-3 text-xs font-bold uppercase tracking-widest cursor-pointer list-none border-b border-gray-200">
              THÔNG TIN SẢN PHẨM
              <span className="transition-transform group-open:rotate-45 text-lg font-light">+</span>
            </summary>
            <div className="py-3 text-xs text-gray-600 leading-relaxed space-y-2">
              {product.material && <p><strong>Chất liệu:</strong> {product.material}</p>}
              <p><strong>Phong cách:</strong> <span className="capitalize">{product.style}</span></p>
              {/* {product.brand && <p><strong>Thương hiệu:</strong> {product.brand}</p>} */}
              <p><strong>Mã SP:</strong> SKU-{product._id.slice(-6).toUpperCase()}</p>
            </div>
          </details>

          <details className="mb-3 group">
            <summary className="flex justify-between items-center py-3 text-xs font-bold uppercase tracking-widest cursor-pointer list-none border-b border-gray-200">
              CÁC CÂU HỎI THƯỜNG GẶP
              <span className="transition-transform group-open:rotate-45 text-lg font-light">+</span>
            </summary>
            <div className="py-3 text-xs text-gray-600 leading-relaxed space-y-2">
              <p><strong>Giao hàng:</strong> Miễn phí từ 500k.</p>
              <p><strong>Đổi trả:</strong> 30 ngày, còn nguyên tem.</p>
            </div>
          </details>

          <details className="group">
            <summary className="flex justify-between items-center py-3 text-xs font-bold uppercase tracking-widest cursor-pointer list-none border-b border-gray-200">
              GIAO HÀNG & ĐỔI TRẢ
              <span className="transition-transform group-open:rotate-45 text-lg font-light">+</span>
            </summary>
            <div className="py-3 text-xs text-gray-600 leading-relaxed space-y-2">
              <p>Miễn phí giao hàng toàn quốc cho đơn từ 500.000đ.</p>
              <p>Hỗ trợ đổi trả trong vòng 30 ngày.</p>
            </div>
          </details>
        </aside>

        {/* ── Cột 2: Ảnh sản phẩm ── */}
        <div className="relative flex">
          {/* Thumbnail strip dọc bên trái */}
          {galleryImages.length > 1 && (
            <div className="hidden lg:flex flex-col gap-2 p-3 w-[80px] shrink-0">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`w-full aspect-square border-2 overflow-hidden transition-all cursor-pointer p-0 bg-transparent ${
                    activeImage === img ? "border-black" : "border-transparent opacity-40 hover:opacity-80"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Ảnh chính */}
          <div className="flex-1 relative bg-gray-50 overflow-hidden group" style={{ minHeight: "600px" }}>
            {activeImage ? (
              <img
                key={activeImage}
                src={activeImage}
                alt={product.name}
                className={`w-full h-full object-contain transition-transform duration-300 ${isZoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"}`}
                onClick={() => setIsZoomed(z => !z)}
                style={{ maxHeight: "80vh" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">Chưa có ảnh</div>
            )}

            {/* Zoom icon hint */}
            <button
              onClick={() => setIsZoomed(z => !z)}
              className="absolute bottom-4 right-4 w-9 h-9 bg-white/80 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-gray-200 shadow-sm"
            >
              <ZoomIn size={16} />
            </button>

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
        <div className="border-l border-gray-100 p-6 lg:p-8 flex flex-col gap-5 lg:sticky lg:top-20 self-start">

          {/* Tên sản phẩm */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
              SKU-{product._id.slice(-6).toUpperCase()}
            </p>
            <h1 className="text-xl font-extrabold text-black leading-tight tracking-wide uppercase">
              {product.name}
            </h1>
          </div>

          {/* Giá */}
          <div className="flex items-center gap-3 py-3 border-t border-b border-gray-100">
            <span className="text-2xl font-extrabold text-black">
              {finalPrice.toLocaleString("vi-VN")}₫
            </span>
            {discountedPrice && (
              <>
                <span className="text-sm text-gray-400 line-through">
                  {product.price.toLocaleString("vi-VN")}₫
                </span>
                <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5">
                  -{product.discount}%
                </span>
              </>
            )}
          </div>

          {/* Màu sắc */}
          {availableColors.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 text-black">
                {selectedColor}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableColors.map(color => {
                  const v = variants.find(v => v.color === color);
                  return (
                    <button
                      key={color}
                      title={color}
                      onClick={() => handleColorChange(color)}
                      className={`w-14 h-[72px] border-2 overflow-hidden transition-all cursor-pointer p-0 bg-transparent ${
                        color === selectedColor ? "border-black" : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {v?.image
                        ? <img src={v.image} alt={color} className="w-full h-full object-cover" />
                        : <span className="text-[9px] uppercase tracking-wider flex items-center justify-center w-full h-full bg-gray-100 px-1 text-center leading-tight">{color}</span>
                      }
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
                <button className="text-[10px] text-gray-500 flex items-center gap-1 underline uppercase tracking-widest hover:text-black border-none bg-transparent cursor-pointer">
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
                      className={`h-10 min-w-[44px] px-3 border text-xs font-bold uppercase tracking-wider transition-all relative ${
                        isOutOfStock
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
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-black">SỐ LƯỢNG</p>
              {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
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
              <button
                onClick={handleBuyNow}
                disabled={!selectedVariant || selectedVariant.stock === 0}
                className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-gray-100 transition-colors cursor-pointer border border-black text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                MUA NGAY
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors text-center block mt-2"
            >
              ĐĂNG NHẬP ĐỂ MUA HÀNG
            </Link>
          )}

          {/* Thông báo */}
          {message && (
            <div className="py-3 px-4 bg-green-50 border border-green-200 text-green-700 text-xs font-bold uppercase tracking-widest">
              ✓ {message}
            </div>
          )}
          {error && (
            <div className="py-3 px-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-widest">
              {error}
            </div>
          )}

          {/* Mô tả ngắn */}
          {product.description && (
            <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
              {product.description}
            </p>
          )}
        </div>
      </div>

      {/* Sản phẩm liên quan */}
      {relatedWithVariants.length > 0 && (
        <section className="border-t border-gray-200 py-16 px-6">
          <h2 className="text-xl font-extrabold tracking-widest text-black uppercase mb-10">
            SẢN PHẨM BAN CHẠY NHẤT
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 gap-y-10">
            {relatedWithVariants.map(item => (
              <ProductCard key={item._id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
