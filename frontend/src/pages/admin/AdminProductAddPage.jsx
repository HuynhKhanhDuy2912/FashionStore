import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import ImageUpload from "../../components/ImageUpload.jsx";
import { Star, Trash2, Pencil, X, Copy } from "lucide-react";
import toast from "react-hot-toast";

const initialForm = {
  name: "", description: "", price: "", discount: 0, categoryId: "",
  brand: "", material: "", style: "casual",
  season: "all_season", occasion: "casual", mainImage: "",
  color: "", sizes: "", stock: 0
};

const initialVariantForm = {
  size: "", color: "", stock: 0, priceAdjustment: 0, image: ""
};

export default function AdminProductAddPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [selectedLevel1Id, setSelectedLevel1Id] = useState("");
  const [selectedLevel2Id, setSelectedLevel2Id] = useState("");
  const [galleryImages, setGalleryImages] = useState([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [newGalleryColor, setNewGalleryColor] = useState("");
  const [variants, setVariants] = useState([]);
  const [variantForm, setVariantForm] = useState(initialVariantForm);
  const [editingVariantId, setEditingVariantId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const catRes = await apiRequest("/categories?limit=1000", { token });
        const cats = catRes.data || [];
        setCategories(cats);
        if (editId) {
          const [prodRes, imgRes, varRes] = await Promise.all([
            apiRequest(`/products/${editId}`, { token }),
            apiRequest(`/product-images?productId=${editId}&limit=50`, { token }),
            apiRequest(`/product-variants?productId=${editId}&limit=100`, { token })
          ]);
          const p = prodRes.data;
          const catId = p.categoryId?._id || "";
          // Trace back: find the category and its ancestors
          const cat = cats.find(c => c._id === catId);
          const parentId = cat?.parentId?._id || "";
          const parent = cats.find(c => c._id === parentId);
          const grandParentId = parent?.parentId?._id || "";
          // Determine depth: 0=root, 1=level2, 2=level3
          if (grandParentId) {
            // catId is level3
            setSelectedLevel1Id(grandParentId);
            setSelectedLevel2Id(parentId);
          } else if (parentId) {
            // catId is level2
            setSelectedLevel1Id(parentId);
            setSelectedLevel2Id("");
          } else {
            // catId is level1 (root)
            setSelectedLevel1Id("");
            setSelectedLevel2Id("");
          }
          setForm({
            name: p.name || "", description: p.description || "",
            price: p.price || "", discount: p.discount || 0,
            categoryId: catId, brand: p.brand || "",
            material: p.material || "",
            style: p.style || "casual", season: p.season?.[0] || "all_season",
            occasion: p.occasion?.[0] || "casual", mainImage: p.images?.[0] || "",
            color: "", sizes: "", stock: 0
          });
          setGalleryImages(imgRes.data || []);
          setGalleryImages(imgRes.data || []);
          setVariants(varRes.data || []);
        }
      } catch (e) { toast.error(e.message); }
    };
    load();
  }, [token, editId]);

  // ── Product submit ──
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (!editId && (!form.color || !form.sizes)) {
        toast.error("Vui lòng nhập Màu sắc và Kích cỡ cho sản phẩm mới");
        setLoading(false);
        return;
      }
      if (!form.categoryId) {
        toast.error("Vui lòng chọn danh mục cho sản phẩm");
        setLoading(false);
        return;
      }

      const payload = {
        name: form.name, description: form.description,
        price: Number(form.price), discount: Number(form.discount),
        categoryId: form.categoryId, brand: form.brand,
        material: form.material, style: form.style,
        season: [form.season], occasion: [form.occasion],
        images: form.mainImage ? [form.mainImage] : []
      };
      if (editId) {
        await apiRequest(`/products/${editId}`, { method: "PUT", token, body: payload });
        toast.success("Đã cập nhật sản phẩm thành công");
      } else {
        const res = await apiRequest("/products", { method: "POST", token, body: payload });
        const newProductId = res.data._id;
        
        // Tạo biến thể ban đầu
        const sizesList = form.sizes.split(',').map(s => s.trim()).filter(Boolean);
        const baseSku = Date.now().toString(36).toUpperCase();
        
        await Promise.all(sizesList.map((size) => {
          const finalSku = sizesList.length > 1 ? `${baseSku}-${size.toUpperCase()}` : baseSku;
          return apiRequest("/product-variants", {
            method: "POST",
            token,
            body: {
               productId: newProductId,
               color: form.color.trim(),
               size: size,
               sku: finalSku,
               stock: Number(form.stock),
               priceAdjustment: 0
            }
          });
        }));

        toast.success("Đã thêm sản phẩm và biến thể ban đầu");
        navigate(`/admin/products/add?id=${newProductId}`, { replace: true });
      }
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  // ── Gallery ──
  const handleAddGallery = async () => {
    if (!newGalleryUrl || !editId) return;
    try {
      const isFirst = galleryImages.length === 0;
      const res = await apiRequest("/product-images", { 
        method: "POST", 
        token, 
        body: { productId: editId, imageUrl: newGalleryUrl, isMain: isFirst, color: newGalleryColor } 
      });
      setGalleryImages(prev => [...prev, res.data]);
      setNewGalleryUrl("");
      toast.success("Đã thêm ảnh vào gallery");
    } catch (e) { toast.error(e.message); }
  };
  const handleDeleteGallery = async (id) => {
    try { await apiRequest(`/product-images/${id}`, { method: "DELETE", token }); setGalleryImages(prev => prev.filter(i => i._id !== id)); toast.success("Đã xóa ảnh"); } catch (e) { toast.error(e.message); }
  };
  const handleSetMain = async (id) => {
    try {
      await Promise.all(galleryImages.map(img => apiRequest(`/product-images/${img._id}`, { method: "PUT", token, body: { ...img, isMain: img._id === id } })));
      setGalleryImages(prev => prev.map(img => ({ ...img, isMain: img._id === id })));
      toast.success("Đã đặt làm ảnh chính");
    } catch (e) { toast.error(e.message); }
  };

  // ── Variants ──
  const handleAddVariant = async (e) => {
    e.preventDefault();
    if (!variantForm.color || !variantForm.size) { toast.error("Vui lòng điền đủ: Màu, Kích cỡ"); return; }
    try {
      const baseBody = { color: variantForm.color.trim(), stock: Number(variantForm.stock), priceAdjustment: Number(variantForm.priceAdjustment), image: variantForm.image, productId: editId };
      const sizes = variantForm.size.split(',').map(s => s.trim()).filter(Boolean);
      
      if (editingVariantId) {
        await apiRequest(`/product-variants/${editingVariantId}`, { method: "PUT", token, body: { ...baseBody, size: sizes[0] } });
        toast.success("Đã cập nhật biến thể");
      } else {
        const baseSku = Date.now().toString(36).toUpperCase();
        await Promise.all(sizes.map((size) => {
          const finalSku = sizes.length > 1 ? `${baseSku}-${size.toUpperCase()}` : baseSku;
          return apiRequest("/product-variants", { method: "POST", token, body: { ...baseBody, size, sku: finalSku } });
        }));
        toast.success(`Đã thêm ${sizes.length} biến thể`);
      }
      setVariantForm(initialVariantForm); setEditingVariantId("");
      const varRes = await apiRequest(`/product-variants?productId=${editId}&limit=100`, { token });
      setVariants(varRes.data || []);
    } catch (e) { toast.error(e.message); }
  };
  const handleEditVariant = (v) => {
    setEditingVariantId(v._id);
    setVariantForm({ size: v.size, color: v.color, stock: v.stock || 0, priceAdjustment: v.priceAdjustment || 0, image: v.image || "" });
  };
  const handleDeleteVariant = async (id) => {
    try {
      await apiRequest(`/product-variants/${id}`, { method: "DELETE", token });
      setVariants(prev => prev.filter(v => v._id !== id)); toast.success("Đã xóa biến thể");
    } catch (e) { toast.error(e.message); }
  };
  const handleCloneVariant = (v) => {
    setEditingVariantId("");
    setVariantForm({ size: "", color: v.color, sku: "", stock: v.stock || 0, priceAdjustment: v.priceAdjustment || 0, image: v.image || "" });
  };

  // ── Helpers ──
  const field = (key) => ({ value: form[key], onChange: (e) => setForm(c => ({ ...c, [key]: e.target.value })) });
  const vField = (key) => ({ value: variantForm[key], onChange: (e) => setVariantForm(c => ({ ...c, [key]: e.target.value })) });

  const inputCls = "border border-gray-200 px-4 py-3 bg-white text-black text-sm focus:border-black focus:outline-none w-full transition-colors";
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-gray-500 flex flex-col gap-1.5";
  const cardCls = "bg-white border border-gray-200 p-6 grid gap-5";
  const headingCls = "text-xs font-bold uppercase tracking-widest text-black pb-4 border-b border-gray-100 m-0";

  const level1Categories = categories.filter(c => !c.parentId);
  const level2Categories = selectedLevel1Id ? categories.filter(c => c.parentId?._id === selectedLevel1Id) : [];
  const level3Categories = selectedLevel2Id ? categories.filter(c => c.parentId?._id === selectedLevel2Id) : [];

  const groupedVariants = useMemo(() => {
    const map = new Map();
    variants.forEach(v => {
      const color = v.color || "Không xác định";
      if (!map.has(color)) map.set(color, []);
      map.get(color).push(v);
    });
    return map;
  }, [variants]);

  return (
    <section className="grid gap-0">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-6 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0 mb-1">Sản phẩm / {editId ? "Chỉnh sửa" : "Thêm mới"}</p>
          <h1 className="text-xl font-bold uppercase tracking-widest m-0 text-black">{editId ? "SỬA SẢN PHẨM" : "THÊM SẢN PHẨM MỚI"}</h1>
        </div>
        <button type="button" onClick={() => navigate("/admin/products/list")} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-black bg-white border border-gray-300 hover:border-black transition-colors cursor-pointer">← Quay lại</button>
      </div>

      <form id="product-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-[1fr_360px] gap-0">
          {/* LEFT COL */}
          <div className="border-r border-gray-200 p-8 grid gap-6 content-start">
            {/* Basic info */}
            <div className={cardCls}>
              <h2 className={headingCls}>Thông tin cơ bản</h2>
              <label className={labelCls}>Tên sản phẩm *<input className={inputCls} required placeholder="Vd: Áo thun oversize basic" {...field("name")} /></label>
              <label className={labelCls}>Mô tả sản phẩm<textarea className={inputCls} rows="4" placeholder="Mô tả chi tiết..." value={form.description} onChange={e => setForm(c => ({ ...c, description: e.target.value }))} /></label>
              <div className="grid grid-cols-3 gap-4">
                <label className={labelCls}>Danh mục cấp 1 *
                  <select className={inputCls} value={selectedLevel1Id} onChange={e => {
                    const id = e.target.value;
                    setSelectedLevel1Id(id);
                    setSelectedLevel2Id("");
                    const children = categories.filter(c => c.parentId?._id === id);
                    setForm(c => ({ ...c, categoryId: children.length === 0 ? id : "" }));
                  }}>
                    <option value="">Chọn cấp 1...</option>
                    {level1Categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </label>
                {selectedLevel1Id && level2Categories.length > 0 && (
                  <label className={labelCls}>Danh mục cấp 2
                    <select className={inputCls} value={selectedLevel2Id || form.categoryId} onChange={e => {
                      const id = e.target.value;
                      const children = categories.filter(c => c.parentId?._id === id);
                      setSelectedLevel2Id(id);
                      setForm(c => ({ ...c, categoryId: children.length === 0 ? id : "" }));
                    }}>
                      <option value="">Chọn cấp 2...</option>
                      {level2Categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                {selectedLevel2Id && level3Categories.length > 0 && (
                  <label className={labelCls}>Danh mục cấp 3
                    <select className={inputCls} value={form.categoryId} onChange={e => setForm(c => ({ ...c, categoryId: e.target.value }))}>
                      <option value="">Chọn cấp 3...</option>
                      {level3Categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </div>
            
            {/* Initial Variants (Only show when creating new product) */}
            {!editId && (
              <div className={cardCls}>
                <h2 className={headingCls}>Thông tin bán hàng ban đầu</h2>
                <div className="grid grid-cols-3 gap-4">
                  <label className={labelCls}>Màu sắc đầu tiên *<input className={inputCls} required placeholder="Vd: Đen" {...field("color")} /></label>
                  <label className={labelCls}>Kích cỡ (các size cách nhau dấu phẩy) *<input className={inputCls} required placeholder="Vd: S, M, L, XL" {...field("sizes")} /></label>
                  <label className={labelCls}>Tồn kho mỗi size *<input className={inputCls} required type="number" min="0" placeholder="0" {...field("stock")} /></label>
                </div>
              </div>
            )}
            
            {/* Price */}
            <div className={cardCls}>
              <h2 className={headingCls}>Giá bán</h2>
              <div className="grid grid-cols-2 gap-4">
                <label className={labelCls}>Giá gốc (VND) *<div className="relative"><input className={inputCls + " pr-10"} type="number" min="0" required placeholder="0" {...field("price")} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">₫</span></div></label>
                <label className={labelCls}>Giảm giá (%)<div className="relative"><input className={inputCls + " pr-10"} type="number" min="0" max="100" placeholder="0" {...field("discount")} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">%</span></div></label>
              </div>
              {form.price && Number(form.discount) > 0 && (
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500 uppercase tracking-widest">Giá sau giảm</span>
                  <span className="text-sm font-bold text-black">{Math.round(Number(form.price) * (1 - Number(form.discount) / 100)).toLocaleString("vi-VN")}₫</span>
                </div>
              )}
            </div>
            {/* Classification */}
            <div className={cardCls}>
              <h2 className={headingCls}>Phân loại</h2>
              <div className="grid grid-cols-2 gap-4">
                <label className={labelCls}>Kiểu dáng
                  <select className={inputCls} {...field("style")}>
                    <option value="casual">Thường ngày (Casual)</option>
                    <option value="minimal">Tối giản (Minimal)</option>
                    <option value="streetwear">Đường phố (Streetwear)</option>
                    <option value="elegant">Thanh lịch (Elegant)</option>
                    <option value="sporty">Thể thao (Sporty)</option>
                    <option value="vintage">Cổ điển (Vintage)</option>
                    <option value="smart_casual">Công sở năng động (Smart Casual)</option>
                  </select>
                </label>
                <label className={labelCls}>Mùa
                  <select className={inputCls} {...field("season")}>
                    <option value="all_season">Tất cả mùa</option>
                    <option value="spring">Mùa Xuân</option>
                    <option value="summer">Mùa Hè</option>
                    <option value="autumn">Mùa Thu</option>
                    <option value="winter">Mùa Đông</option>
                  </select>
                </label>
                <label className={labelCls}>Dịp mặc
                  <select className={inputCls} {...field("occasion")}>
                    <option value="casual">Thường ngày</option>
                    <option value="work">Đi làm</option>
                    <option value="party">Tiệc tùng</option>
                    <option value="date">Hẹn hò</option>
                    <option value="travel">Du lịch</option>
                    <option value="sport">Thể thao</option>
                    <option value="formal">Trang trọng</option>
                    <option value="street">Dạo phố</option>
                  </select>
                </label>
                <label className={labelCls}>Thương hiệu<input className={inputCls} placeholder="Vd: Paradox, Levents..." {...field("brand")} /></label>
                <label className={labelCls}>Chất liệu<input className={inputCls} placeholder="Vd: Cotton, Polyester..." {...field("material")} /></label>
              </div>
            </div>
          </div>

          {/* RIGHT COL */}
          <div className="p-6 grid gap-6 content-start">
            <div className={cardCls}>
              <h2 className={headingCls}>Ảnh chính</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0">Ảnh hiển thị trên danh sách & trang chủ</p>
              <ImageUpload label="" value={form.mainImage} onChange={url => setForm(c => ({ ...c, mainImage: url }))} />
            </div>

            {editId ? (
              <div className={cardCls}>
                <h2 className={headingCls}>Ảnh Gallery ({galleryImages.length})</h2>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0">Ảnh hiển thị trong trang chi tiết</p>
                
                <div className="border border-dashed border-gray-300 p-4 grid gap-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelCls}>Màu sắc (Tùy chọn)
                      <select className={inputCls} value={newGalleryColor} onChange={e => setNewGalleryColor(e.target.value)}>
                        <option value="">Tất cả màu</option>
                        {[...new Set(variants.map(v => v.color))].filter(Boolean).map(color => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <ImageUpload label="" value={newGalleryUrl} onChange={url => setNewGalleryUrl(url)} />
                  {newGalleryUrl && <button type="button" onClick={handleAddGallery} className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 border-none cursor-pointer transition-colors">+ Thêm vào gallery {newGalleryColor ? `(${newGalleryColor})` : ''}</button>}
                </div>
                
                {galleryImages.length > 0 && (
                  <div className="mt-2 space-y-4">
                    {/* Group gallery images by color for better admin overview */}
                    {['', ...new Set(variants.map(v => v.color))].map(color => {
                      const imgs = galleryImages.filter(img => (img.color || '') === color);
                      if (imgs.length === 0) return null;
                      return (
                        <div key={color || 'all'}>
                          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-100 pb-1">
                            {color ? `MÀU: ${color}` : 'ẢNH CHUNG (Tất cả màu)'}
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            {imgs.map(img => (
                              <div key={img._id} className={`relative border-2 ${img.isMain ? "border-black" : "border-gray-200"} group`}>
                                <img src={img.imageUrl} alt="" className="w-full aspect-square object-cover" />
                                {img.isMain && <span className="absolute top-1 left-1 bg-black text-white text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">CHÍNH</span>}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  {!img.isMain && <button type="button" title="Đặt làm ảnh chính" onClick={() => handleSetMain(img._id)} className="p-1.5 bg-white hover:bg-yellow-50 cursor-pointer border-none"><Star size={14} className="text-black" /></button>}
                                  <button type="button" title="Xóa ảnh" onClick={() => handleDeleteGallery(img._id)} className="p-1.5 bg-white hover:bg-red-50 cursor-pointer border-none"><Trash2 size={14} className="text-red-600" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0">Lưu sản phẩm trước để thêm ảnh gallery</p>
              </div>
            )}

            <button form="product-form" type="submit" disabled={loading} className="w-full py-4 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer border-none disabled:opacity-50">
              {loading ? "ĐANG LƯU..." : editId ? "✓ LƯU THAY ĐỔI" : "+ THÊM SẢN PHẨM"}
            </button>
          </div>
        </div>
      </form>

      {/* ── VARIANTS SECTION ── */}
      {editId && (
        <div className="border-t border-gray-200 p-8">
          <div className={cardCls}>
            <h2 className={headingCls}>Biến thể sản phẩm ({variants.length})</h2>

            {/* Add/edit variant form */}
            <form onSubmit={handleAddVariant} className="bg-gray-50 border border-gray-200 p-5 grid gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-black m-0">
                {editingVariantId ? "✏ SỬA BIẾN THỂ" : "+ THÊM BIẾN THỂ MỚI"}
              </p>
              <div className="grid grid-cols-4 gap-3">
                <label className={labelCls}>Màu sắc *<input className={inputCls} placeholder="Đen, Trắng..." {...vField("color")} /></label>
                <label className={labelCls}>Kích cỡ *<input className={inputCls} placeholder="S, M, L..." {...vField("size")} disabled={!!editingVariantId} /></label>
                <label className={labelCls}>Tồn kho<input className={inputCls} type="number" min="0" {...vField("stock")} /></label>
                <label className={labelCls}>Giá ±<input className={inputCls} type="number" {...vField("priceAdjustment")} /></label>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <ImageUpload label="Ảnh biến thể" value={variantForm.image} onChange={url => setVariantForm(c => ({ ...c, image: url }))} />
                </div>
                <div className="flex gap-2 shrink-0 pb-1">
                  <button type="submit" className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 border-none cursor-pointer transition-colors">
                    {editingVariantId ? "CẬP NHẬT" : "THÊM"}
                  </button>
                  {editingVariantId && (
                    <button type="button" onClick={() => { setEditingVariantId(""); setVariantForm(initialVariantForm); }} className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-black bg-white border border-black hover:bg-gray-100 cursor-pointer transition-colors">HỦY</button>
                  )}
                </div>
              </div>
            </form>

            {/* Variants table grouped by color */}
            {variants.length > 0 ? (
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-16">Ảnh</th>
                      <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">Màu sắc</th>
                      <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">Kích cỡ</th>
                      <th className="text-left py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">SKU</th>
                      <th className="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">Tồn kho</th>
                      <th className="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">Giá ±</th>
                      <th className="text-right py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-32">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...groupedVariants.entries()].map(([color, items]) => (
                      items.map((v, idx) => (
                        <tr key={v._id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx === 0 ? "border-t-2 border-t-gray-200" : ""}`}>
                          <td className="py-3 px-3">
                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                              {v.image ? <img src={v.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full grid place-items-center text-[8px] text-gray-300 uppercase">N/A</div>}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {idx === 0 ? <span className="font-bold text-black">{color}</span> : <span className="text-gray-300">↳</span>}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block border border-gray-300 px-3 py-1 text-xs font-bold text-black">{v.size}</span>
                          </td>
                          <td className="py-3 px-3 text-xs text-gray-500 font-mono">{v.sku}</td>
                          <td className={`py-3 px-3 text-right font-bold ${v.stock <= 10 ? "text-red-600" : "text-black"}`}>{v.stock}</td>
                          <td className="py-3 px-3 text-right text-xs text-gray-500">{v.priceAdjustment > 0 ? `+${v.priceAdjustment.toLocaleString("vi-VN")}` : v.priceAdjustment < 0 ? v.priceAdjustment.toLocaleString("vi-VN") : "—"}</td>
                          <td className="py-3 px-3">
                            <div className="flex gap-1 justify-end">
                              <button type="button" title="Nhân bản" onClick={() => handleCloneVariant(v)} className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 cursor-pointer border-none bg-transparent transition-colors"><Copy size={14} /></button>
                              <button type="button" title="Sửa" onClick={() => handleEditVariant(v)} className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 cursor-pointer border-none bg-transparent transition-colors"><Pencil size={14} /></button>
                              <button type="button" title="Xóa" onClick={() => handleDeleteVariant(v._id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer border-none bg-transparent transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400 m-0">Chưa có biến thể nào</p>
                <p className="text-[10px] text-gray-300 uppercase tracking-widest mt-1 m-0">Thêm biến thể đầu tiên bằng form phía trên</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
