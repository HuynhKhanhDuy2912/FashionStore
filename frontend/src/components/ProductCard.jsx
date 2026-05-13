import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { getProductPath } from "../lib/slug.js";

function getColorGroups(product) {
  const groups = new Map();
  const variants = product.availableVariants || [];

  variants.forEach((variant) => {
    const key = (variant.color || "Mặc định").trim();
    if (!groups.has(key)) {
      groups.set(key, {
        color: key,
        previewImage: variant.image || product.images?.[0] || "",
        variants: []
      });
    }
    groups.get(key).variants.push(variant);
    if (!groups.get(key).previewImage && variant.image) {
      groups.get(key).previewImage = variant.image;
    }
  });

  if (groups.size === 0) {
    groups.set("Mặc định", {
      color: "Mặc định",
      previewImage: product.images?.[0] || "",
      variants: []
    });
  }

  return [...groups.values()];
}

function formatPrice(price) {
  return `${Number(price || 0).toLocaleString("vi-VN")} ₫`;
}

export default function ProductCard({
  product,
  onAddToWishlist,
  onAddToCart,
  actionLabel = "THÊM GIỎ"
}) {
  const colorGroups = useMemo(() => getColorGroups(product), [product]);
  const [activeColorName, setActiveColorName] = useState(colorGroups[0]?.color || "");
  const [quickAdd, setQuickAdd] = useState(null);

  const activeColorGroup =
    colorGroups.find((group) => group.color === activeColorName) || colorGroups[0];
  const primaryImage =
    activeColorGroup?.previewImage || product.images?.[0] || "https://placehold.co/900x1200/F5F5F5/222?text=Fashion";
  const secondaryImage =
    product.images?.[1] ||
    activeColorGroup?.variants?.find((item) => item.image && item.image !== primaryImage)?.image ||
    primaryImage;

  const sizes = [...new Set((activeColorGroup?.variants || []).map((item) => item.size).filter(Boolean))];
  const selectedSize = quickAdd?.size || sizes[0] || "";
  const selectedVariant =
    (activeColorGroup?.variants || []).find((item) => item.size === selectedSize) ||
    activeColorGroup?.variants?.[0] ||
    null;
  const productPath = getProductPath(product, { color: activeColorGroup?.color });
  const price = Number(product.price || 0) + Number(selectedVariant?.priceAdjustment || 0);

  const handleQuickAddToggle = () => {
    setQuickAdd((current) => (current ? null : { size: sizes[0] || "" }));
  };

  const handleAddToCart = () => {
    if (!selectedVariant || !onAddToCart) return;
    onAddToCart(product, selectedVariant);
    setQuickAdd(null);
  };

  return (
    <article className="group bg-white">
      <div className="relative overflow-hidden bg-gray-100">
        <Link to={productPath} className="absolute inset-0 block">
          <img
            src={primaryImage}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
          />
          <img
            src={secondaryImage}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        </Link>

        <div className="aspect-[4/5]" />

        <div
          className="absolute inset-x-0 bottom-0 h-[52px] border-t border-gray-200 bg-white/95 px-3 py-1"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(219,231,245,0.55) 0px, rgba(219,231,245,0.55) 2px, rgba(255,255,255,0.9) 2px, rgba(255,255,255,0.9) 4px)"
          }}
        >
          <div className="flex h-full items-center justify-center gap-3">
            {product.collectionName || product.tags?.[0] ? (
              <p className="mr-auto text-[11px] font-semibold leading-4 text-red-600">
                {product.collectionName || product.tags?.[0]}
              </p>
            ) : null}
            {onAddToCart ? (
              <button
                type="button"
                onClick={handleQuickAddToggle}
                className="grid h-8 w-8 place-items-center rounded-full border border-gray-300 bg-white text-black transition hover:border-black"
                aria-label="Thêm nhanh vào giỏ"
              >
                {quickAdd ? <X size={14} /> : <Plus size={16} />}
              </button>
            ) : null}
          </div>
        </div>

        {quickAdd ? (
          <div className="absolute bottom-14 right-2 z-10 w-44 border border-gray-200 bg-white p-3 shadow-xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Chọn size</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {(sizes.length ? sizes : ["M"]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setQuickAdd({ size })}
                  className={`h-8 w-8 border text-xs font-medium transition ${selectedSize === size
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-black hover:border-black"
                    }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedVariant}
              className="w-full bg-black py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div className="bg-white px-3 py-3">
        {product.recommendationReasons?.length ? (
          <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-widest text-gray-500">
            {product.recommendationReasons[0]}
          </span>
        ) : null}

        <div className="mt-2 flex items-center gap-2">
          {colorGroups.slice(0, 6).map((group) => (
            <button
              key={`${product._id}-${group.color}`}
              type="button"
              title={group.color}
              onMouseEnter={() => setActiveColorName(group.color)}
              onClick={() => setActiveColorName(group.color)}
              className={`relative m-0 h-10 w-8 overflow-hidden border bg-white p-0 transition-all ${activeColorGroup?.color === group.color
                ? "border-black"
                : "border-gray-200 opacity-70 hover:opacity-100"
                }`}
            >
              {group.previewImage ? (
                <img src={group.previewImage} alt={group.color} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center px-0.5 text-center text-[8px] font-bold uppercase leading-tight tracking-widest">
                  {group.color}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="m-0 text-[16px] font-semibold text-black">{formatPrice(price)}</p>
          {onAddToWishlist ? (
            <button
              type="button"
              onClick={() => onAddToWishlist(product)}
              className="shrink-0 text-xs font-medium text-gray-500 transition hover:text-red-600"
            >
              Yêu thích
            </button>
          ) : null}
        </div>

        <h3 className="line-clamp-1 text-[18px] font-bold text-black">
          <Link to={productPath} className="hover:text-red-600">{product.name}</Link>
        </h3>
      </div>
    </article>
  );
}
