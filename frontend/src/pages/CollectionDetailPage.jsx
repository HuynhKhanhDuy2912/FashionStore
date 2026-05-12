import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";

export default function CollectionDetailPage() {
  const { collectionId } = useParams();
  const { token } = useAuth();

  const [collection, setCollection] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Try slug first, fallback to id
        let colRes;
        try {
          colRes = await apiRequest(`/collections/slug/${collectionId}`);
        } catch {
          colRes = await apiRequest(`/collections/${collectionId}`);
        }

        const col = colRes.data;
        setCollection(col);

        // Load variants for these products
        if (col.products?.length > 0) {
          const productIds = col.products.map((p) => p._id || p);
          const varRes = await apiRequest("/product-variants?limit=500");
          const allVariants = varRes.data || [];
          setVariants(
            allVariants.filter((v) => productIds.includes(v.productId?._id || v.productId))
          );
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    window.scrollTo(0, 0);
  }, [collectionId]);

  const productsWithVariants = useMemo(() => {
    if (!collection?.products) return [];
    return attachVariantsToProducts(collection.products, variants);
  }, [collection, variants]);

  const handleAddToCart = async (product, variant) => {
    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: variant._id,
          quantity: 1,
          source: "collection",
        },
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">{error || "Đang tải..."}</p>
        </div>
      </section>
    );
  }

  if (!collection) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Không tìm thấy</h2>
          <p className="text-gray-500 text-sm mb-6">Bộ sưu tập này không tồn tại hoặc đã bị xóa.</p>
          <Link
            to="/collections"
            className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            XEM TẤT CẢ BỘ SƯU TẬP
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div>
      {/* ── Hero Banner ── */}
      <section className="relative h-[50vh] min-h-[380px] flex items-end overflow-hidden bg-black">
        {collection.coverImage ? (
          <img
            src={collection.coverImage}
            alt={collection.name}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-8 pb-10">
          <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 mb-4">
            <Link to="/" className="hover:text-white">TRANG CHỦ</Link>
            <span>/</span>
            <Link to="/collections" className="hover:text-white">BỘ SƯU TẬP</Link>
            <span>/</span>
            <span className="text-white truncate max-w-[200px]">{collection.name}</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white uppercase tracking-wide m-0 mb-3">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-white/70 text-sm leading-relaxed m-0 max-w-2xl">
              {collection.description}
            </p>
          )}
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-4 m-0">
            {productsWithVariants.length} SẢN PHẨM
          </p>
        </div>
      </section>

      {/* ── Products Grid ── */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12">
        {productsWithVariants.length === 0 ? (
          <div className="text-center py-16 border border-gray-200">
            <p className="text-gray-400 text-sm m-0">Bộ sưu tập chưa có sản phẩm nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {productsWithVariants.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToCart={token ? handleAddToCart : null}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-gray-200 py-12 text-center">
        <Link
          to="/collections"
          className="inline-block px-10 py-4 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
        >
          XEM TẤT CẢ BỘ SƯU TẬP
        </Link>
      </section>
    </div>
  );
}
