import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { apiRequest } from "../lib/api.js";
import { sortVariantsBySize } from "../lib/sizes.js";
import { formatProductName } from "../lib/productName.js";

const CHECKOUT_SELECTION_KEY = "fashionstore_checkout_cart_item_ids";

const formatCurrency = (value = 0) => `${Number(value).toLocaleString("vi-VN")} đ`;

export default function CartPage() {
  const { token } = useAuth();
  const { refreshCartCount } = useCart();
  const navigate = useNavigate();
  const initializedSelection = useRef(false);

  const [cart, setCart] = useState(null);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/carts/me", { token });
      setCart(response.data);
      setError("");
      return response.data;
    } catch (loadError) {
      setError(loadError.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    const productIds = [
      ...new Set((cart?.items || []).map((item) => item.productId?._id).filter(Boolean))
    ];
    const missingProductIds = productIds.filter((productId) => !variantsByProduct[productId]);

    if (!missingProductIds.length) return;

    let isMounted = true;

    Promise.all(
      missingProductIds.map(async (productId) => {
        const response = await apiRequest(`/product-variants?productId=${productId}&limit=100`, { token });
        return [productId, response.data || []];
      })
    )
      .then((entries) => {
        if (!isMounted) return;
        setVariantsByProduct((current) => ({
          ...current,
          ...Object.fromEntries(entries)
        }));
      })
      .catch((variantError) => setError(variantError.message));

    return () => {
      isMounted = false;
    };
  }, [cart?.items, token, variantsByProduct]);

  useEffect(() => {
    const itemIds = cart?.items?.map((item) => item._id) || [];

    if (itemIds.length === 0) {
      initializedSelection.current = false;
      setSelectedIds([]);
      return;
    }

    setSelectedIds((current) => {
      if (!initializedSelection.current) {
        initializedSelection.current = true;
        return itemIds;
      }

      return current.filter((id) => itemIds.includes(id));
    });
  }, [cart?.items]);

  const selectedItems = useMemo(
    () => cart?.items?.filter((item) => selectedIds.includes(item._id)) || [],
    [cart?.items, selectedIds]
  );

  const selectedItemCount = selectedItems.length;

  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + (item.pricing?.lineTotal || 0), 0),
    [selectedItems]
  );

  const isFreeShipping = selectedSubtotal >= 999000;
  const shippingFeeDisplay = selectedSubtotal === 0 ? "0 đ" : isFreeShipping ? "Miễn phí" : "Tính khi thanh toán";
  
  // Tổng cộng ở giỏ hàng sẽ chỉ là tạm tính nếu chưa biết phí ship
  const selectedTotal = selectedSubtotal;
  const totalCartCount = cart?.items?.length || 0;
  const hasItems = Boolean(cart?.items?.length);
  const allSelected = hasItems && selectedIds.length === cart.items.length;

  const toggleItem = (itemId) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  };

  const toggleAll = () => {
    if (!cart?.items?.length) return;
    setSelectedIds(allSelected ? [] : cart.items.map((item) => item._id));
  };

  const updateItem = async (cartItemId, quantity, extraBody = {}) => {
    try {
      await apiRequest(`/carts/me/items/${cartItemId}`, {
        method: "PUT",
        token,
        body: { quantity, ...extraBody }
      });
      await loadCart();
      await refreshCartCount();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateVariant = async (item, variantId) => {
    if (!variantId || variantId === item.variantId?._id) return;
    await updateItem(item._id, item.quantity, { variantId });
  };

  const removeItem = async (cartItemId) => {
    try {
      await apiRequest(`/carts/me/items/${cartItemId}`, {
        method: "DELETE",
        token
      });
      setSelectedIds((current) => current.filter((id) => id !== cartItemId));
      await loadCart();
      await refreshCartCount();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleCheckout = () => {
    if (!selectedIds.length) return;

    sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(selectedIds));
    navigate("/checkout", { state: { cartItemIds: selectedIds } });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-0">
      <PageHeader
        title="Giỏ hàng của bạn"
        description={
          hasItems
            ? `${totalCartCount} sản phẩm trong giỏ, ${selectedItemCount} sản phẩm đang được chọn`
            : "Chọn sản phẩm yêu thích và hoàn tất đơn hàng khi bạn sẵn sàng."
        }
        aside={
          hasItems ? (
            <Link
              to="/products"
              className="inline-flex items-center gap-2 border border-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-black transition hover:bg-black hover:text-white"
            >
              Tiếp tục mua sắm
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null
        }
      />

      {error ? (
        <p className="mb-6 border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      {!hasItems && !loading ? (
        <div className="border border-gray-200 bg-gray-50 px-6 py-24 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-sm">
            <ShoppingCart className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <h3 className="mb-3 text-xl font-bold uppercase tracking-widest text-black">Giỏ hàng trống</h3>
          <p className="mx-auto mb-8 max-w-md text-sm leading-6 text-gray-500">
            Bạn chưa có sản phẩm nào trong giỏ hàng. Khám phá bộ sưu tập mới và thêm những món phù hợp với phong cách của bạn.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center justify-center bg-black px-8 py-4 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      ) : null}

      {hasItems ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-3 text-left text-sm font-semibold text-black"
              >
                <span
                  className={`grid h-5 w-5 place-items-center border transition ${allSelected ? "border-black bg-black text-white" : "border-gray-300 bg-white text-transparent"
                    }`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                Chọn tất cả
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {cart.items.length} dòng sản phẩm
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {cart.items.map((item) => {
                const isSelected = selectedIds.includes(item._id);
                const imageUrl =
                  item.variantId?.image ||
                  item.productId?.images?.[0] ||
                  "https://placehold.co/240x320/f8fafc/94a3b8?text=FashionStore";
                const productVariants = (variantsByProduct[item.productId?._id] || []).filter(
                  (variant) => variant.isActive
                );
                const colors = [...new Set(productVariants.map((variant) => variant.color).filter(Boolean))];
                const currentColor = item.variantId?.color || "";
                const currentSize = item.variantId?.size || "";
                const displayName = formatProductName(item.productId?.name);
                const sizesForColor = sortVariantsBySize(
                  productVariants.filter((variant) => variant.color === currentColor)
                );

                return (
                  <article
                    key={item._id}
                    className={`grid gap-5 px-5 py-5 transition md:grid-cols-[auto_112px_minmax(0,1fr)_auto] md:items-center ${isSelected ? "bg-gray-50/70" : "bg-white"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(item._id)}
                      className={`grid h-6 w-6 place-items-center border transition ${isSelected ? "border-black bg-black text-white" : "border-gray-300 bg-white text-transparent hover:border-black"
                        }`}
                      aria-label={isSelected ? "Bỏ chọn sản phẩm" : "Chọn sản phẩm để thanh toán"}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>

                    <div className="h-36 w-28 overflow-hidden bg-gray-100 md:h-40">
                      <img
                        src={imageUrl}
                        alt={displayName || "Sản phẩm"}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <h3 className="mb-2 line-clamp-2 text-base font-bold uppercase tracking-wide text-black">
                        {displayName}
                      </h3>
                      <div className="mb-4 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                          Màu
                          <select
                            value={currentColor}
                            onChange={(event) => {
                              const nextColor = event.target.value;
                              const nextVariant =
                                productVariants.find(
                                  (variant) =>
                                    variant.color === nextColor &&
                                    variant.size === currentSize &&
                                    variant.stock > 0
                                ) ||
                                productVariants.find(
                                  (variant) => variant.color === nextColor && variant.stock > 0
                                ) ||
                                productVariants.find((variant) => variant.color === nextColor);
                              updateVariant(item, nextVariant?._id);
                            }}
                            className="h-10 border border-gray-300 bg-white px-3 text-sm font-bold uppercase tracking-wide text-black outline-none transition focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
                            disabled={!colors.length}
                          >
                            {colors.length ? (
                              colors.map((color) => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))
                            ) : (
                              <option value={currentColor}>{currentColor || "N/A"}</option>
                            )}
                          </select>
                        </label>

                        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                          Size
                          <select
                            value={currentSize}
                            onChange={(event) => {
                              const nextSize = event.target.value;
                              const nextVariant = productVariants.find(
                                (variant) => variant.color === currentColor && variant.size === nextSize
                              );
                              updateVariant(item, nextVariant?._id);
                            }}
                            className="h-10 border border-gray-300 bg-white px-3 text-sm font-bold uppercase tracking-wide text-black outline-none transition focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
                            disabled={!sizesForColor.length}
                          >
                            {sizesForColor.length ? (
                              sizesForColor.map((variant) => (
                                <option key={variant._id} value={variant.size} disabled={variant.stock <= 0}>
                                  {variant.size}{variant.stock <= 0 ? " - hết hàng" : ""}
                                </option>
                              ))
                            ) : (
                              <option value={currentSize}>{currentSize || "N/A"}</option>
                            )}
                          </select>
                        </label>
                      </div>
                      <p className="text-sm text-gray-500">
                        Đơn giá:{" "}
                        <span className="font-bold text-black">{formatCurrency(item.pricing?.unitPrice)}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 md:flex-col md:items-end">
                      <div className="flex items-center border border-gray-300 bg-white">
                        <button
                          type="button"
                          className="grid h-10 w-10 place-items-center text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                          onClick={() => updateItem(item._id, Math.max(item.quantity - 1, 1))}
                          disabled={item.quantity <= 1}
                          aria-label="Giảm số lượng"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-11 text-center text-sm font-bold text-black">{item.quantity}</span>
                        <button
                          type="button"
                          className="grid h-10 w-10 place-items-center text-black transition hover:bg-gray-100"
                          onClick={() => updateItem(item._id, item.quantity + 1)}
                          aria-label="Tăng số lượng"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <p className="text-right text-lg font-bold text-black">
                        {formatCurrency(item.pricing?.lineTotal)}
                      </p>

                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-red-600"
                        onClick={() => removeItem(item._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="h-fit border border-gray-200 bg-white p-6 lg:sticky lg:top-24">
            <h2 className="mb-5 text-base font-bold uppercase tracking-wide text-black">Tóm tắt thanh toán</h2>

            <div className="space-y-3 border-b border-gray-200 pb-5 text-sm">
              <div className="flex items-center justify-between text-gray-500">
                <span>Sản phẩm đã chọn</span>
                <span className="font-semibold text-black">{selectedItemCount}</span>
              </div>
              <div className="flex items-center justify-between text-gray-500">
                <span>Tạm tính</span>
                <span className="font-semibold text-black">{formatCurrency(selectedSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-500">
                <span>Phí vận chuyển dự kiến</span>
                <span className="font-semibold text-black">
                  {shippingFeeDisplay}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200 py-5">
              <span className="text-sm font-bold uppercase tracking-widest text-black">Tổng cộng</span>
              <span className="text-2xl font-extrabold text-black">{formatCurrency(selectedTotal)}</span>
            </div>

            <div className="my-5 grid gap-3 text-xs font-semibold text-gray-500">
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-black" />
                Miễn phí vận chuyển từ 999.000 đ
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-black" />
                Sản phẩm chưa chọn sẽ được giữ lại trong giỏ hàng
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={!selectedIds.length}
              className="flex w-full items-center justify-center gap-2 bg-black px-6 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Thanh toán
              <ChevronRight className="h-4 w-4" />
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
