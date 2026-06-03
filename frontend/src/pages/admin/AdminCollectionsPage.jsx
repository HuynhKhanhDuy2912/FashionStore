import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import ImageUpload from "../../components/ImageUpload.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { formatProductName } from "../../lib/productName.js";
import {
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

const initialForm = {
  name: "",
  description: "",
  coverImage: "",
  bannerImage: "",
  isActive: true,
  order: 0,
  products: [],
};

export default function AdminCollectionsPage() {
  const { token } = useAuth();

  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  // ── Load data ──
  const loadCollections = async () => {
    try {
      const res = await apiRequest("/collections?limit=100", { token });
      setCollections(res.data || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await apiRequest("/products?limit=200", { token });
      setAllProducts(res.data || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    loadCollections();
    loadProducts();
  }, [token]);

  // ── Form handlers ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên bộ sưu tập");
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        coverImage: form.coverImage,
        bannerImage: form.bannerImage,
        isActive: form.isActive,
        order: Number(form.order) || 0,
        products: form.products.map((p) => (typeof p === "string" ? p : p._id)),
      };

      if (editingId) {
        await apiRequest(`/collections/${editingId}`, {
          method: "PUT",
          token,
          body: payload,
        });
        toast.success("Đã cập nhật bộ sưu tập thành công!");
      } else {
        await apiRequest("/collections", {
          method: "POST",
          token,
          body: payload,
        });
        toast.success("Đã tạo bộ sưu tập mới");
      }

      setForm(initialForm);
      setEditingId("");
      setShowProductPicker(false);
      loadCollections();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleEdit = (collection) => {
    setEditingId(collection._id);
    setForm({
      name: collection.name,
      description: collection.description || "",
      coverImage: collection.coverImage || "",
      bannerImage: collection.bannerImage || "",
      isActive: collection.isActive,
      order: collection.order || 0,
      products: collection.products || [],
    });
    setShowProductPicker(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (collection) => {
    if (!window.confirm(`Xóa bộ sưu tập "${collection.name}"?`)) return;
    try {
      await apiRequest(`/collections/${collection._id}`, {
        method: "DELETE",
        token,
      });
      toast.success(`Đã xóa "${collection.name}"`);
      loadCollections();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggleActive = async (collection) => {
    try {
      await apiRequest(`/collections/${collection._id}`, {
        method: "PUT",
        token,
        body: { isActive: !collection.isActive },
      });
      toast.success(
        collection.isActive ? "Đã ẩn bộ sưu tập" : "Đã hiển thị bộ sưu tập",
      );
      loadCollections();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleCancel = () => {
    setForm(initialForm);
    setEditingId("");
    setShowProductPicker(false);
  };

  // ── Product picker ──
  const addProduct = (product) => {
    if (form.products.some((p) => (p._id || p) === product._id)) return;
    setForm((prev) => ({ ...prev, products: [...prev.products, product] }));
  };

  const removeProduct = (productId) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((p) => (p._id || p) !== productId),
    }));
  };

  // Build a map: productId → list of collection names it belongs to
  const productCollectionsMap = useMemo(() => {
    const map = new Map();
    collections.forEach((col) => {
      (col.products || []).forEach((p) => {
        const pid = p._id || p;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid).push(col.name);
      });
    });
    return map;
  }, [collections]);

  const filteredPickerProducts = allProducts.filter((p) => {
    const alreadySelected = form.products.some(
      (sp) => (sp._id || sp) === p._id,
    );
    if (alreadySelected) return false;
    if (!productSearch.trim()) return true;
    return p.name.toLowerCase().includes(productSearch.toLowerCase());
  });

  // ── Styles ──
  const inputCls =
    "border border-gray-200 px-4 py-3 bg-white text-black text-sm focus:border-black focus:outline-none w-full transition-colors";
  const labelCls =
    "text-[10px] font-bold uppercase tracking-widest text-gray-500 flex flex-col gap-1.5";
  const btnPrimary =
    "flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-gray-800";
  const btnSecondary =
    "px-6 py-3 text-xs font-bold uppercase tracking-widest rounded-md text-black bg-white hover:bg-gray-100 transition-colors cursor-pointer border border-gray-300";

  return (
    <section className="grid gap-6 p-6">
      <AdminPageHeader
        title="QUẢN LÝ BỘ SƯU TẬP"
        description={`Tổng cộng ${collections.length} bộ sưu tập`}
      />

      {/* ── FORM ── */}
      <div className="bg-white border border-gray-200 p-6 rounded-md">
        <h3 className="text-xs font-bold uppercase tracking-widest text-black pb-4 border-b border-gray-100 m-0 mb-5">
          {editingId ? "SỬA BỘ SƯU TẬP" : "TẠO BỘ SƯU TẬP MỚI"}
        </h3>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
            {/* Left side */}
            <div className="grid gap-4">
              <label className={labelCls}>
                Tên bộ sưu tập *
                <input
                  className={inputCls}
                  placeholder="Ví dụ: Xuân Hạ 2026"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>

              <label className={labelCls}>
                Mô tả
                <textarea
                  className={inputCls + " min-h-[80px] resize-y"}
                  placeholder="Mô tả ngắn gọn về bộ sưu tập..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  Thứ tự hiển thị
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, order: e.target.value }))
                    }
                  />
                </label>

                <label className={labelCls}>
                  Trạng thái
                  <select
                    className={inputCls}
                    value={form.isActive ? "true" : "false"}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        isActive: e.target.value === "true",
                      }))
                    }
                  >
                    <option value="true">Hiển thị</option>
                    <option value="false">Ẩn</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Right side — cover image */}
            <div className="grid gap-5">
              <ImageUpload
                label="ẢNH BÌA"
                value={form.coverImage}
                onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
              />
              <ImageUpload
                label="ẢNH BANNER"
                value={form.bannerImage}
                onChange={(url) => setForm((f) => ({ ...f, bannerImage: url }))}
              />
            </div>
          </div>

          {/* ── Product picker section ── */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                SẢN PHẨM TRONG BỘ SƯU TẬP ({form.products.length})
              </span>
              <button
                type="button"
                className="text-xs font-bold text-black underline cursor-pointer bg-transparent border-none"
                onClick={() => setShowProductPicker(!showProductPicker)}
              >
                {showProductPicker ? "ĐÓNG" : "+ THÊM SẢN PHẨM"}
              </button>
            </div>

            {/* Selected products chips */}
            {form.products.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {form.products.map((p) => {
                  const product =
                    typeof p === "string"
                      ? allProducts.find((ap) => ap._id === p)
                      : p;
                  const name = formatProductName(product?.name) || "Sản phẩm";
                  const img = product?.images?.[0];
                  const id = product?._id || p;

                  const belongsTo = productCollectionsMap.get(id) || [];

                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 group"
                    >
                      {img && (
                        <img
                          src={img}
                          alt=""
                          className="w-8 h-8 object-cover border border-gray-100"
                        />
                      )}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-medium text-black max-w-[150px] truncate">
                          {name}
                        </span>
                        {belongsTo.length > 0 && (
                          <span className="text-[9px] text-amber-600 font-medium truncate max-w-[150px]" title={belongsTo.join(", ")}>
                            {belongsTo.join(", ")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduct(id)}
                        className="text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Product picker dropdown */}
            {showProductPicker && (
              <div className="border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 mb-3">
                  <Search size={16} className="text-gray-400" />
                  <input
                    className="flex-1 border-none outline-none text-sm bg-transparent"
                    placeholder="Tìm sản phẩm theo tên..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-[300px] overflow-y-auto grid gap-1">
                  {filteredPickerProducts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4 m-0">
                      Không tìm thấy sản phẩm
                    </p>
                  ) : (
                    filteredPickerProducts.slice(0, 20).map((product) => (
                      <button
                        key={product._id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex items-center gap-3 px-3 py-2 text-left hover:bg-white transition-colors cursor-pointer border-none bg-transparent w-full"
                      >
                        <div className="w-10 h-10 bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              className="w-full h-full object-cover"
                              alt=""
                            />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-[8px] text-gray-300">
                              N/A
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-black m-0 truncate">
                            {formatProductName(product.name)}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-400 m-0">
                              {product.price?.toLocaleString("vi-VN")}₫
                            </p>
                            {(productCollectionsMap.get(product._id) || []).length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200" title={(productCollectionsMap.get(product._id) || []).join(", ")}>
                                {(productCollectionsMap.get(product._id) || []).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button type="submit" className={btnPrimary}>
              {editingId ? "CẬP NHẬT" : "TẠO BỘ SƯU TẬP"}
            </button>
            {editingId && (
              <button
                type="button"
                className={btnSecondary}
                onClick={handleCancel}
              >
                HỦY
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── LIST ── */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-md">
        <div className="grid min-w-[940px] grid-cols-[80px_140px_1fr_100px_100px_80px_120px] gap-4 px-5 py-3 border-b border-gray-200 bg-gray-50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Ảnh bìa
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Banner
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Tên
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">
            Sản phẩm
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">
            Thứ tự
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">
            Trạng thái
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">
            Thao tác
          </span>
        </div>

        {collections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400 m-0">Chưa có bộ sưu tập nào</p>
            <p className="text-[10px] text-gray-300 uppercase tracking-widest mt-1 m-0">
              Tạo bộ sưu tập đầu tiên bằng form phía trên
            </p>
          </div>
        ) : (
          collections.map((col) => (
            <div
              key={col._id}
              className="grid min-w-[940px] grid-cols-[80px_140px_1fr_100px_100px_80px_120px] gap-4 px-5 py-4 items-center border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              {/* Cover */}
              <div className="w-16 h-16 bg-gray-100 border border-gray-200 overflow-hidden">
                {col.coverImage ? (
                  <img
                    src={col.coverImage}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[8px] text-gray-300 uppercase">
                    N/A
                  </div>
                )}
              </div>

              {/* Banner */}
              <div className="h-16 w-32 overflow-hidden border border-gray-200 bg-gray-100">
                {col.bannerImage ? (
                  <img
                    src={col.bannerImage}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[8px] uppercase text-gray-300">
                    N/A
                  </div>
                )}
              </div>

              {/* Name + description */}
              <div className="min-w-0">
                <p className="text-sm font-bold text-black m-0 truncate">
                  {col.name}
                </p>
                {col.description && (
                  <p className="text-[11px] text-gray-400 m-0 mt-0.5 truncate">
                    {col.description}
                  </p>
                )}
              </div>

              {/* Product count */}
              <span className="text-xs text-gray-600 font-medium text-center">
                {col.products?.length || 0} sản phẩm
              </span>

              {/* Order */}
              <span className="text-xs text-gray-500 font-mono text-center">
                {col.order}
              </span>

              {/* Status */}
              <button
                type="button"
                onClick={() => handleToggleActive(col)}
                className={`flex items-center justify-center text-xs font-bold uppercase tracking-widest cursor-pointer bg-transparent border-none p-0 ${col.isActive ? "text-green-600" : "text-gray-400"
                  }`}
                title={col.isActive ? "Bấm để ẩn" : "Bấm để hiện"}
              >
                {col.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>

              {/* Actions */}
              <div className="flex gap-1 justify-center">
                <button
                  type="button"
                  onClick={() => handleEdit(col)}
                  className="flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                  title="Sửa"
                >
                  <Pencil size={12} /> Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(col)}
                  className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                  title="Xóa"
                >
                  <Trash2 size={12} /> Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
