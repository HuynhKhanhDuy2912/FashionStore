import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import toast from "react-hot-toast";

export default function AdminProductListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  const loadProducts = async () => {
    try {
      const res = await apiRequest("/products?limit=100", { token });
      setProducts(res.data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [token]);

  const handleDelete = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      await apiRequest(`/products/${product._id}`, { method: "DELETE", token });
      toast.success(`Đã xóa sản phẩm "${product.name}"`);
      loadProducts();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.categoryId?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="grid gap-6">
      <AdminPageHeader
        title="DANH SÁCH SẢN PHẨM"
        description={`Tổng cộng ${products.length} sản phẩm`}
      />

      {/* Toolbar */}
      <div className="flex gap-4 items-center justify-between">
        <input
          type="text"
          placeholder="Tìm kiếm theo tên, danh mục,..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 px-4 py-3 bg-white text-black text-sm focus:border-black focus:outline-none flex-1 max-w-md"
        />
        <button
          onClick={() => navigate("/admin/products/add")}
          className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer border-none shrink-0"
        >
          + THÊM SẢN PHẨM
        </button>
      </div>

      {/* Bảng sản phẩm */}
      <div className="bg-white border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-[64px_1fr_140px_100px_80px_120px] gap-4 px-5 py-3 border-b border-gray-200 bg-gray-50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ảnh</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Sản phẩm</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Danh mục</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Giá</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Giảm</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Thao tác</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              {search ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
            </p>
          ) : (
            filtered.map(product => (
              <div
                key={product._id}
                className="grid grid-cols-[64px_1fr_140px_100px_80px_120px] gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors"
              >
                {/* Ảnh */}
                <div className="w-14 h-14 bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} className="w-full h-full object-cover" alt={product.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">N/A</div>
                  )}
                </div>

                {/* Tên */}
                <div>
                  <strong className="block text-black text-sm mb-1 line-clamp-1">{product.name}</strong>
                  <p className="m-0 text-[10px] text-gray-400 uppercase tracking-widest">
                    {product.style}
                  </p>
                </div>

                {/* Danh mục */}
                <span className="text-xs text-gray-600 uppercase tracking-widest">
                  {product.categoryId?.name || "—"}
                </span>

                {/* Giá */}
                <span className="text-sm font-bold text-black">
                  {Number(product.price).toLocaleString("vi-VN")}₫
                </span>

                {/* Giảm giá */}
                <span className={`text-xs font-bold uppercase tracking-widest ${product.discount > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {product.discount > 0 ? `-${product.discount}%` : "—"}
                </span>

                {/* Thao tác */}
                <div className="flex gap-2 justify-end">
                  <button
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black bg-white border border-black hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/products/add?id=${product._id}`)}
                  >
                    SỬA
                  </button>
                  <button
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 border border-red-600 cursor-pointer transition-colors"
                    onClick={() => handleDelete(product)}
                  >
                    XÓA
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
