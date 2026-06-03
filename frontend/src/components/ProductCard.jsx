import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Plus, X } from "lucide-react";
import { getProductPath } from "../lib/slug.js";
import { sortSizes } from "../lib/sizes.js";
import { formatProductName } from "../lib/productName.js";

function getColorGroups(product) {
  const groups = new Map();
  const variants = product.availableVariants || [];

  variants.forEach((variant) => {
    const key = (variant.color || "Mặc định").trim();
    if (!groups.has(key)) {
      groups.set(key, {
        color: key,
        previewImage: variant.image || "",
        variants: []
      });
    }
    groups.get(key).variants.push(variant);
    if (!groups.get(key).previewImage && variant.image) {
      groups.get(key).previewImage = variant.image;
    }
  });

  groups.forEach((group) => {
    if (!group.previewImage) {
      group.previewImage = product.images?.[0] || "";
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
  actionLabel = "THÊM GIỎ",
  isWishlisted = false
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

  const sizes = sortSizes([...new Set((activeColorGroup?.variants || []).map((item) => item.size).filter(Boolean))]);
  const selectedSize = quickAdd?.size || sizes[0] || "";
  const selectedVariant =
    (activeColorGroup?.variants || []).find((item) => item.size === selectedSize) ||
    activeColorGroup?.variants?.[0] ||
    null;
  const selectedVariantOutOfStock = Number(selectedVariant?.stock || 0) <= 0;
  const productPath = getProductPath(product, { color: activeColorGroup?.color });
  const displayName = formatProductName(product.name);

  const basePrice = Number(product.price || 0);
  const adjustment = Number(selectedVariant?.priceAdjustment || 0);
  const priceBeforeDiscount = basePrice + adjustment;
  const productDiscount = product.discount || 0;
  const variantDiscount = selectedVariant?.discount;
  const effectiveDiscount = (variantDiscount !== null && variantDiscount !== undefined)
    ? variantDiscount
    : productDiscount;
  const price = effectiveDiscount > 0
    ? Math.round(priceBeforeDiscount * (1 - effectiveDiscount / 100))
    : priceBeforeDiscount;

  const handleQuickAddToggle = () => {
    setQuickAdd((current) => (current ? null : { size: sizes[0] || "" }));
  };

  const handleAddToCart = () => {
    if (!selectedVariant || selectedVariantOutOfStock || !onAddToCart) return;
    onAddToCart(product, selectedVariant);
    setQuickAdd(null);
  };

  return (
    <article className="group bg-white">
      <div className="relative overflow-hidden bg-gray-100">
        <Link to={productPath} className="absolute inset-0 block">
          <img
            src={primaryImage}
            alt={displayName}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
          />
          <img
            src={secondaryImage}
            alt={displayName}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        </Link>

        <div className="aspect-[4/5]" />

        <div
          className="absolute inset-x-0 bottom-0 h-[48px] border-t border-gray-100 bg-white/95 px-3 py-1"
        >
          <div className="flex h-full items-center justify-center gap-3">
            {product.collectionName || product.collectionId?.name ? (
              <p className="mr-auto text-[15px] font-semibold leading-4 text-red-600">
                {product.collectionName || product.collectionId?.name}
              </p>
            ) : null}
            {onAddToCart ? (
              <button
                type="button"
                onClick={handleQuickAddToggle}
                className="grid h-8 w-8 place-items-center rounded-none border border-gray-300 bg-white text-black transition hover:border-black hover:bg-black hover:text-white"
                aria-label="Thêm nhanh vào giỏ"
              >
                {quickAdd ? <X size={14} /> : <Plus size={16} />}
              </button>
            ) : null}
          </div>
        </div>

        {quickAdd ? (
          <div className="absolute bottom-14 right-2 z-10 w-50 border border-gray-200 bg-white p-3 shadow-xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Chọn size</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {(sizes.length ? sizes : ["M"]).map((size) => {
                const variantForSize =
                  (activeColorGroup?.variants || []).find((item) => item.size === size) || null;
                const isOutOfStock = Number(variantForSize?.stock || 0) <= 0;

                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => !isOutOfStock && setQuickAdd({ size })}
                    disabled={isOutOfStock}
                    className={`relative h-8 w-8 border text-xs font-medium transition ${isOutOfStock
                      ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                      : selectedSize === size
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black hover:border-black"
                      }`}
                  >
                    {size}
                    {isOutOfStock ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                        <span className="h-[1px] w-[140%] -rotate-45 bg-gray-400" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedVariant || selectedVariantOutOfStock}
              className="w-full bg-black py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedVariantOutOfStock ? "HẾT HÀNG" : actionLabel}
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

        <div className="mt-1 flex items-center gap-2">
          {colorGroups.slice(0, 6).map((group) => (
            <button
              key={`${product._id}-${group.color}`}
              type="button"
              title={group.color}
              onMouseEnter={() => setActiveColorName(group.color)}
              onClick={() => setActiveColorName(group.color)}
              className={`relative m-0 h-[50px] w-[40px] overflow-hidden border bg-white p-0 transition-all ${activeColorGroup?.color === group.color
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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="m-0 text-[15px] font-medium text-black">
              {formatPrice(price)}
            </p>
            {effectiveDiscount > 0 && (
              <>
                <p className="m-0 text-[15px] font-normal text-gray-400 line-through decoration-gray-400 decoration-[1px]">
                  {formatPrice(priceBeforeDiscount)}
                </p>
                <span className="inline-flex items-center bg-[#b91c1c] px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wider">
                  -{effectiveDiscount}%
                </span>
              </>
            )}
          </div>
          {onAddToWishlist ? (
            <button
              type="button"
              onClick={() => onAddToWishlist(product)}
              className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium transition text-red-600 hover:text-red-400`}
            >
              <Heart size={13} className={isWishlisted ? "fill-red-600 text-red-600" : "text-current"} />
              Yêu thích
            </button>
          ) : null}
        </div>

        <h3 className="line-clamp-1 text-[15px] font-bold text-black">
          <Link to={productPath} className="hover:text-red-600">{displayName}</Link>
        </h3>
      </div>
    </article>
  );
}
