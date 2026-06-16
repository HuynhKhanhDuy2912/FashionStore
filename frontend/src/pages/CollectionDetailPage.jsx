import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";
import { formatProductName } from "../lib/productName.js";
import { trackBehavior } from "../lib/tracking.js";

export default function CollectionDetailPage() {
  const { collectionId } = useParams();
  const { token } = useAuth();

  const [collection, setCollection] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let colRes;
        try {
          colRes = await apiRequest(`/collections/slug/${collectionId}`);
        } catch {
          colRes = await apiRequest(`/collections/${collectionId}`);
        }

        const col = colRes.data;
        setCollection(col);

        if (col.products?.length > 0) {
          const productIds = col.products.map((product) => product._id || product);
          const varRes = await apiRequest("/product-variants?limit=2000");
          const allVariants = varRes.data || [];
          setVariants(
            allVariants.filter((variant) => productIds.includes(variant.productId?._id || variant.productId))
          );
        }

        if (token) {
          try {
            const wishlistRes = await apiRequest("/wishlists/me", { token });
            setWishlistProductIds(
              new Set(
                (wishlistRes?.data?.items || [])
                  .map((item) => item.productId?._id)
                  .filter(Boolean)
              )
            );
          } catch {
            // Bỏ qua lỗi tải wishlist, không ảnh hưởng hiển thị sản phẩm
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
    window.scrollTo(0, 0);
  }, [collectionId, token]);

  const productsWithVariants = useMemo(() => {
    if (!collection?.products) return [];
    return attachVariantsToProducts(collection.products, variants).map((product) => ({
      ...product,
      collectionName: product.collectionName || collection?.name || null
    }));
  }, [collection, variants]);

  const handleAddToCart = async (product, variant) => {
    if (!token) {
      toast.error("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.");
      return;
    }

    if (!variant?._id) {
      toast.error("Sản phẩm chưa có biến thể phù hợp để thêm vào giỏ hàng.");
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
          source: "collection"
        }
      });

      toast.success(`Đã thêm ${formatProductName(product.name)} vào giỏ hàng`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleWishlist = async (product) => {
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
          token
        });
        setWishlistProductIds((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
        toast.success(`Đã bỏ ${formatProductName(product.name)} khỏi danh sách yêu thích`);
        trackBehavior(token, {
          actionType: "remove_from_wishlist",
          productId,
          source: "collection"
        });
      } else {
        await apiRequest("/wishlists/me", {
          method: "POST",
          token,
          body: {
            productId,
            addedFrom: "collection"
          }
        });
        setWishlistProductIds((current) => {
          const next = new Set(current);
          next.add(productId);
          return next;
        });
        toast.success(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);
        trackBehavior(token, {
          actionType: "add_to_wishlist",
          productId,
          source: "collection"
        });
      }
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <p className="text-sm text-gray-500">{error || "Đang tải..."}</p>
        </div>
      </section>
    );
  }

  if (!collection) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-bold">Không tìm thấy</h2>
          <p className="mb-6 text-sm text-gray-500">
            Bộ sưu tập này không tồn tại hoặc đã bị xóa.
          </p>
          <Link
            to="/collections"
            className="bg-black px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-800"
          >
            Xem tất cả bộ sưu tập
          </Link>
        </div>
      </section>
    );
  }

  const bannerImage = collection.bannerImage || collection.coverImage;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
      <section className="mb-10 border border-gray-200 bg-white px-5 py-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-bold text-black">{productsWithVariants.length} sản phẩm</span>
            <span className="text-gray-300">/</span>
            <Link to="/" className="text-gray-500 transition hover:text-black">
              Trang chủ
            </Link>
            <span className="text-gray-300">&gt;</span>
            <Link to="/collections" className="text-gray-500 transition hover:text-black">
              Bộ sưu tập
            </Link>
            <span className="text-gray-300">&gt;</span>
            <span className="font-bold text-black">{collection.name}</span>
          </div>
        </div>
      </section>

      <section className="mb-6 overflow-hidden bg-gray-100">
        {bannerImage ? (
          <img src={bannerImage} alt={collection.name} className="h-auto w-full object-cover" />
        ) : (
          <div className="grid aspect-[16/5] place-items-center bg-gray-100 px-6 text-center">
            <div>
              <h1 className="mb-2 text-3xl font-extrabold uppercase tracking-wide text-black md:text-5xl">
                {collection.name}
              </h1>
              {collection.description ? (
                <p className="mx-auto max-w-2xl text-sm leading-6 text-gray-500">{collection.description}</p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {collection.description ? (
        <section className="mb-10">
          <h1 className="mb-3 text-2xl font-extrabold uppercase tracking-wide text-black md:text-3xl">
            {collection.name}
          </h1>
          <p className="m-0 text-sm leading-7 text-gray-500 text-justify">{collection.description}</p>
        </section>
      ) : null}

      <section className="py-4">
        {productsWithVariants.length === 0 ? (
          <div className="border border-gray-200 py-16 text-center">
            <p className="m-0 text-sm text-gray-400">Bộ sưu tập chưa có sản phẩm nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {productsWithVariants.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToCart={handleAddToCart}
                onAddToWishlist={handleWishlist}
                isWishlisted={wishlistProductIds.has(product._id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-gray-200 py-12 text-center">
        <Link
          to="/collections"
          className="inline-block bg-black px-10 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-800"
        >
          Xem tất cả bộ sưu tập
        </Link>
      </section>
    </div>
  );
}
