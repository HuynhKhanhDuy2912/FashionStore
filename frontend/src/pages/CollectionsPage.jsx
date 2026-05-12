import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api.js";

export default function CollectionsPage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest("/collections?limit=50&isActive=true");
        setCollections(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Đang tải bộ sưu tập...</p>
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-14">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 block mb-3">
          FASHION STORE
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-black uppercase m-0 mb-4">
          BỘ SƯU TẬP
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
          Khám phá những bộ sưu tập được tuyển chọn kỹ lưỡng, mang đến phong cách thời trang đa dạng và hiện đại.
        </p>
      </div>

      {/* Grid */}
      {collections.length === 0 ? (
        <div className="text-center py-20 border border-gray-200">
          <p className="text-gray-400 text-sm m-0">Chưa có bộ sưu tập nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {collections.map((col, index) => (
            <Link
              key={col._id}
              to={`/collections/${col.slug || col._id}`}
              className={`group relative overflow-hidden bg-gray-100 block ${
                index === 0 ? "md:col-span-2 min-h-[520px]" : "min-h-[400px]"
              }`}
            >
              {/* Cover image */}
              {col.coverImage ? (
                <img
                  src={col.coverImage}
                  alt={col.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300" />
              )}

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10 text-white">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60 block mb-2">
                  {col.products?.length || 0} SẢN PHẨM
                </span>
                <h2
                  className={`font-extrabold uppercase tracking-wide m-0 mb-3 ${
                    index === 0 ? "text-3xl md:text-4xl" : "text-2xl"
                  }`}
                >
                  {col.name}
                </h2>
                {col.description && (
                  <p className="text-white/80 text-sm leading-relaxed m-0 max-w-lg line-clamp-2">
                    {col.description}
                  </p>
                )}
                <span className="inline-block mt-4 text-xs font-bold uppercase tracking-widest border-b-2 border-white pb-1 group-hover:pb-2 transition-all">
                  KHÁM PHÁ
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
