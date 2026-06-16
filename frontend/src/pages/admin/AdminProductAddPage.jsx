import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import { sortVariantsBySize } from "../../lib/sizes.js";
import MultiImageUpload from "../../components/MultiImageUpload.jsx";
import MultiVideoUpload from "../../components/MultiVideoUpload.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import {
  Star,
  Trash2,
  Pencil,
  Copy,
  ArrowLeft,
  Plus,
  Save,
  Tag,
  FolderOpen,
} from "lucide-react";
import toast from "react-hot-toast";

const initialForm = {
  name: "",
  description: "",
  price: "",
  costPrice: "",
  discount: 0,
  categoryId: "",
  gender: "male",
  material: "",
  style: ["casual"],
  season: ["all_season"],
  occasion: ["casual"],
  mainImage: "",
  gallery: [],
  videos: [],
  color: "",
  sizes: "",
  stock: 0,
};

const initialVariantForm = {
  size: "",
  color: "",
  stock: 0,
  costPrice: "",
  price: "",
  discount: null,
  images: [],
  mainImage: "",
};

const styleOptions = [
  { value: "casual", label: "Thường ngày (Casual)" },
  { value: "minimal", label: "Tối giản (Minimal)" },
  { value: "streetwear", label: "Đường phố (Streetwear)" },
  { value: "elegant", label: "Thanh lịch (Elegant)" },
  { value: "sporty", label: "Thể thao (Sporty)" },
  { value: "vintage", label: "Cổ điển (Vintage)" },
  { value: "smart_casual", label: "Công sở năng động (Smart Casual)" },
];

const seasonOptions = [
  { value: "all_season", label: "Tất cả mùa" },
  { value: "spring", label: "Mùa Xuân" },
  { value: "summer", label: "Mùa Hạ" },
  { value: "autumn", label: "Mùa Thu" },
  { value: "winter", label: "Mùa Đông" },
];

const occasionOptions = [
  { value: "casual", label: "Thường ngày" },
  { value: "work", label: "Đi làm" },
  { value: "party", label: "Tiệc tùng" },
  { value: "date", label: "Hẹn hò" },
  { value: "travel", label: "Du lịch" },
  { value: "sport", label: "Thể thao" },
  { value: "formal", label: "Trang trọng" },
  { value: "street", label: "Dạo phố" },
];

const MultiSelectTags = ({ options, value = [], onChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded cursor-pointer border transition-colors ${value.includes(opt.value)
            ? "bg-black text-white border-black"
            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-black"
            }`}
        >
          <input
            type="checkbox"
            className="hidden"
            checked={value.includes(opt.value)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...value, opt.value]);
              } else {
                onChange(value.filter((v) => v !== opt.value));
              }
            }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
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
  const [newGalleryUrls, setNewGalleryUrls] = useState([]);
  const [newGalleryColor, setNewGalleryColor] = useState("");
  const [variants, setVariants] = useState([]);
  const [variantForm, setVariantForm] = useState(initialVariantForm);
  const [editingVariantId, setEditingVariantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [allCollections, setAllCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [productCollections, setProductCollections] = useState([]); // collections this product belongs to (edit mode)
  const variantsRef = useRef(null);

  useEffect(() => {
    if (editId && searchParams.get("new") === "true" && variantsRef.current) {
      setTimeout(() => {
        variantsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 500);
    }
  }, [editId, searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const catRes = await apiRequest("/categories?limit=1000", { token });
        const cats = catRes.data || [];
        setCategories(cats);

        // Load collections
        const colRes = await apiRequest("/collections?limit=100", { token });
        const cols = colRes.data || [];
        setAllCollections(cols);

        if (editId) {
          const [prodRes, imgRes, varRes] = await Promise.all([
            apiRequest(`/products/${editId}`, { token }),
            apiRequest(`/product-images?productId=${editId}&limit=50`, {
              token,
            }),
            apiRequest(`/product-variants?productId=${editId}&limit=100`, {
              token,
            }),
          ]);

          // Find which collections this product belongs to
          const belongsTo = cols.filter((col) =>
            (col.products || []).some((p) => (p._id || p) === editId)
          );
          setProductCollections(belongsTo);
          if (belongsTo.length > 0) {
            setSelectedCollectionId(belongsTo[0]._id);
          }
          const p = prodRes.data;
          const catId = p.categoryId?._id || "";
          // Trace back: find the category and its ancestors
          const cat = cats.find((c) => c._id === catId);
          const parentId = cat?.parentId?._id || "";
          const parent = cats.find((c) => c._id === parentId);
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
          const galleryData = imgRes.data || [];
          // Fix 1: ưu tiên ảnh gallery có isMain=true thay vì luôn lấy p.images[0]
          const mainGalleryImg =
            galleryData.find((i) => i.isMain)?.imageUrl || p.images?.[0] || "";
          setForm({
            name: p.name || "",
            description: p.description || "",
            price: p.price || "",
            costPrice: p.costPrice || "",
            discount: p.discount || 0,
            categoryId: catId,
            gender: p.gender || "male",
            material: p.material || "",
            style: Array.isArray(p.style) ? p.style : (p.style ? [p.style] : []),
            season: p.season || [],
            occasion: p.occasion || [],
            mainImage: mainGalleryImg,
            gallery: [],
            videos: p.videos || [],
            color: "",
            sizes: "",
            stock: 0,
          });
          setGalleryImages(galleryData);
          setVariants(varRes.data || []);
        }
      } catch (e) {
        toast.error(e.message);
      }
    };
    load();
  }, [token, editId]);

  // ── Product submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
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
        name: form.name,
        description: form.description,
        price: Number(form.price),
        costPrice: Number(form.costPrice) || 0,
        discount: Number(form.discount),
        categoryId: form.categoryId,
        gender: form.gender,
        material: form.material,
        style: form.style,
        season: form.season,
        occasion: form.occasion,
        images: form.mainImage ? [form.mainImage] : [],
        videos: form.videos || [],
      };
      if (editId) {
        await apiRequest(`/products/${editId}`, {
          method: "PUT",
          token,
          body: payload,
        });
        toast.success("Đã cập nhật sản phẩm thành công");
      } else {
        const res = await apiRequest("/products", {
          method: "POST",
          token,
          body: payload,
        });
        const newProductId = res.data._id;

        // Lưu các ảnh trong form.gallery vào ProductImage collection
        if (form.gallery && form.gallery.length > 0) {
          await Promise.all(
            form.gallery.map((url) =>
              apiRequest("/product-images", {
                method: "POST",
                token,
                body: {
                  productId: newProductId,
                  imageUrl: url,
                  isMain: url === form.mainImage,
                  color: form.color.trim(),
                },
              }),
            ),
          );
        }

        // Tạo biến thể ban đầu
        const sizesList = form.sizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const baseSku = Date.now().toString(36).toUpperCase();

        await Promise.all(
          sizesList.map((size) => {
            const finalSku =
              sizesList.length > 1
                ? `${baseSku}-${size.toUpperCase()}`
                : baseSku;
            const initialImage =
              form.mainImage ||
              (form.gallery.length > 0 ? form.gallery[0] : "");
            return apiRequest("/product-variants", {
              method: "POST",
              token,
              body: {
                productId: newProductId,
                color: form.color.trim(),
                size: size,
                sku: finalSku,
                stock: Number(form.stock),
                costPrice: Number(form.costPrice) || 0,
                priceAdjustment: 0,
                image: initialImage,
              },
            });
          }),
        );

        toast.success("Đã thêm sản phẩm thành công!");

        // Add product to selected collection
        if (selectedCollectionId) {
          try {
            const targetCol = allCollections.find((c) => c._id === selectedCollectionId);
            if (targetCol) {
              const existingProductIds = (targetCol.products || []).map((p) => p._id || p);
              await apiRequest(`/collections/${selectedCollectionId}`, {
                method: "PUT",
                token,
                body: { products: [...existingProductIds, newProductId] },
              });
              toast.success(`Đã thêm vào bộ sưu tập "${targetCol.name}"`);
            }
          } catch (colErr) {
            toast.error("Không thể thêm vào bộ sưu tập: " + colErr.message);
          }
        }

        navigate(`/admin/products/add?id=${newProductId}&new=true`, {
          replace: true,
        });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Gallery ──
  const handleAddGallery = async () => {
    if (newGalleryUrls.length === 0 || !editId) return;
    try {
      const isFirst = galleryImages.length === 0;
      await Promise.all(
        newGalleryUrls.map((url, idx) =>
          apiRequest("/product-images", {
            method: "POST",
            token,
            body: {
              productId: editId,
              imageUrl: url,
              isMain: isFirst && idx === 0,
              color: newGalleryColor,
            },
          }).then((res) => {
            setGalleryImages((prev) => [...prev, res.data]);
          }),
        ),
      );
      setNewGalleryUrls([]);
      toast.success(`Đã thêm ${newGalleryUrls.length} ảnh vào gallery`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const handleDeleteGallery = async (id) => {
    try {
      await apiRequest(`/product-images/${id}`, { method: "DELETE", token });
      setGalleryImages((prev) => prev.filter((i) => i._id !== id));
      toast.success("Đã xóa ảnh");
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Xóa ảnh trùng URL trong gallery (giữ lại bản ghi đầu tiên mỗi URL)
  const handleDeduplicateGallery = async () => {
    const seen = new Map(); // url -> bản ghi giữ lại
    const toDelete = [];
    for (const img of galleryImages) {
      const url = img.imageUrl;
      if (!seen.has(url)) {
        seen.set(url, img);
      } else {
        // Ưu tiên giữ bản ghi có isMain=true
        if (img.isMain && !seen.get(url).isMain) {
          toDelete.push(seen.get(url));
          seen.set(url, img);
        } else {
          toDelete.push(img);
        }
      }
    }
    if (toDelete.length === 0) {
      toast("Không có ảnh trùng nào");
      return;
    }
    try {
      await Promise.all(
        toDelete.map((img) =>
          apiRequest(`/product-images/${img._id}/db-only`, {
            method: "DELETE",
            token,
          }),
        ),
      );
      setGalleryImages((prev) =>
        prev.filter((img) => !toDelete.some((d) => d._id === img._id)),
      );
      toast.success(`Đã xóa ${toDelete.length} ảnh trùng`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const handleSetMain = async (id) => {
    try {
      const targetImg = galleryImages.find((img) => img._id === id);
      await Promise.all(
        galleryImages.map((img) =>
          apiRequest(`/product-images/${img._id}`, {
            method: "PUT",
            token,
            body: { ...img, isMain: img._id === id },
          }),
        ),
      );
      // Fix 2: đồng bộ Product.images[] để ProductCard trang danh sách hiển thị đúng
      if (targetImg?.imageUrl) {
        await apiRequest(`/products/${editId}`, {
          method: "PUT",
          token,
          body: { images: [targetImg.imageUrl] },
        });
        setForm((c) => ({ ...c, mainImage: targetImg.imageUrl }));
      }
      setGalleryImages((prev) =>
        prev.map((img) => ({ ...img, isMain: img._id === id })),
      );
      toast.success("Đã đặt làm ảnh chính");
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── Variants ──
  const handleAddVariant = async (e) => {
    e.preventDefault();
    if (!variantForm.color || !variantForm.size) {
      toast.error("Vui lòng điền đủ: Màu, Kích cỡ");
      return;
    }
    try {
      const variantPrice =
        variantForm.price === ""
          ? Number(form.price)
          : Number(variantForm.price);
      const calculatedAdjustment = variantPrice - Number(form.price);

      const baseBody = {
        color: variantForm.color.trim(),
        stock: Number(variantForm.stock),
        costPrice: Number(variantForm.costPrice) || 0,
        priceAdjustment: calculatedAdjustment,
        discount: variantForm.discount,
        image: variantForm.mainImage || variantForm.images[0] || "",
        productId: editId,
      };
      const sizes = variantForm.size
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingVariantId) {
        await apiRequest(`/product-variants/${editingVariantId}`, {
          method: "PUT",
          token,
          body: { ...baseBody, size: sizes[0] },
        });
        
        // THÊM MỚI: Tự động đồng bộ ảnh vừa up cho tất cả các size khác cùng màu
        if (baseBody.image) {
          const otherVariantsSameColor = variants.filter(
            v => v.color === variantForm.color.trim() && v._id !== editingVariantId
          );
          if (otherVariantsSameColor.length > 0) {
            await Promise.all(otherVariantsSameColor.map(v => 
              apiRequest(`/product-variants/${v._id}`, {
                method: "PUT",
                token,
                body: { image: baseBody.image }
              }).catch(err => console.error("Sync variant image error:", err))
            ));
          }
        }
        
        toast.success("Đã cập nhật biến thể thành công!");

        // Fix 3: đồng bộ gallery khi update biến thể có ảnh mới
        // tránh tạo ảnh trùng lặp trong gallery
        if (variantForm.images.length > 0) {
          const sameColorImgs = galleryImages.filter(
            (img) => img.color === variantForm.color.trim(),
          );
          const existingRecord = sameColorImgs[0]; // lấy bản ghi đầu tiên cùng màu

          if (existingRecord && baseBody.image) {
            // cập nhật bản ghi đã có thay vì tạo mới (cập nhật ảnh chính)
            const updatedImg = await apiRequest(
              `/product-images/${existingRecord._id}`,
              {
                method: "PUT",
                token,
                body: {
                  ...existingRecord,
                  imageUrl: baseBody.image,
                },
              },
            );
            setGalleryImages((prev) =>
              prev.map((img) =>
                img._id === existingRecord._id
                  ? { ...img, imageUrl: baseBody.image }
                  : img,
              ),
            );
          } else if (!existingRecord && baseBody.image) {
            // chưa có bản ghi nào cùng màu → tạo mới ảnh chính
            const newImg = await apiRequest("/product-images", {
              method: "POST",
              token,
              body: {
                productId: editId,
                imageUrl: baseBody.image,
                isMain: galleryImages.length === 0,
                color: variantForm.color.trim(),
              },
            });
            setGalleryImages((prev) => [...prev, newImg.data]);
          }

          // Đẩy thêm các ảnh phụ (nếu có)
          const otherImages = variantForm.images.filter(
            (url) => url !== baseBody.image,
          );
          if (otherImages.length > 0) {
            const existingUrls = new Set(
              galleryImages.map((i) => i.imageUrl),
            );
            const newImages = otherImages.filter((url) => !existingUrls.has(url));
            
            if (newImages.length > 0) {
              await Promise.all(
                newImages.map((url) =>
                  apiRequest("/product-images", {
                    method: "POST",
                    token,
                    body: {
                      productId: editId,
                      imageUrl: url,
                      isMain: false,
                      color: variantForm.color.trim(),
                    },
                  }),
                ),
              );
            }
          }
        }
      } else {
        const baseSku = Date.now().toString(36).toUpperCase();
        await Promise.all(
          sizes.map((size) => {
            const finalSku =
              sizes.length > 1 ? `${baseSku}-${size.toUpperCase()}` : baseSku;
            return apiRequest("/product-variants", {
              method: "POST",
              token,
              body: { ...baseBody, size, sku: finalSku },
            });
          }),
        );
        toast.success(`Đã thêm ${sizes.length} biến thể`);

        // Tự động đẩy ảnh biến thể vào Gallery chung nếu có ảnh mới
        // Chỉ tạo mới nếu chưa có bản ghi cùng màu để tránh duplicate
        if (variantForm.images.length > 0) {
          const existingColors = new Set(
            galleryImages.map((img) => img.color || ""),
          );
          const newColor = variantForm.color.trim();
          if (!existingColors.has(newColor)) {
            // Chưa có ảnh nào cho màu này → thêm ảnh đại diện
            await apiRequest("/product-images", {
              method: "POST",
              token,
              body: {
                productId: editId,
                imageUrl: baseBody.image,
                isMain: galleryImages.length === 0,
                color: newColor,
              },
            });
            
            // THÊM: Cũng đẩy luôn các ảnh phụ còn lại của biến thể này lên
            const otherImages = variantForm.images.filter(
              (url) => url !== baseBody.image,
            );
            if (otherImages.length > 0) {
              await Promise.all(
                otherImages.map((url) =>
                  apiRequest("/product-images", {
                    method: "POST",
                    token,
                    body: {
                      productId: editId,
                      imageUrl: url,
                      isMain: false,
                      color: newColor,
                    },
                  }),
                ),
              );
            }
          } else {
            // Đã có ảnh cho màu này → push các ảnh phụ còn lại (bỏ ảnh main đã tồn tại)
            const otherImages = variantForm.images.filter(
              (url) => url !== baseBody.image,
            );
            await Promise.all(
              otherImages.map((url) =>
                apiRequest("/product-images", {
                  method: "POST",
                  token,
                  body: {
                    productId: editId,
                    imageUrl: url,
                    isMain: false,
                    color: newColor,
                  },
                }),
              ),
            );
          }
          // Refresh gallery
          const imgRes = await apiRequest(
            `/product-images?productId=${editId}&limit=50`,
            { token },
          );
          setGalleryImages(imgRes.data || []);
          toast.success(`Đã đồng bộ ảnh vào Gallery`);
        }
      }
      setVariantForm(initialVariantForm);
      setEditingVariantId("");
      const varRes = await apiRequest(
        `/product-variants?productId=${editId}&limit=100`,
        { token },
      );
      setVariants(varRes.data || []);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const handleEditVariant = (v) => {
    setEditingVariantId(v._id);
    setVariantForm({
      size: v.size,
      color: v.color,
      stock: v.stock || 0,
      costPrice: v.costPrice || 0,
      price: Number(form.price) + (v.priceAdjustment || 0),
      discount: v.discount ?? null,
      images: v.image ? [v.image] : [],
      mainImage: v.image || "",
    });
  };
  const handleDeleteVariant = async (id) => {
    try {
      await apiRequest(`/product-variants/${id}`, { method: "DELETE", token });
      setVariants((prev) => prev.filter((v) => v._id !== id));
      toast.success("Đã xóa biến thể thành công!");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const handleCloneVariant = (v) => {
    setEditingVariantId("");
    setVariantForm({
      size: v.size || "",
      color: v.color,
      stock: v.stock || 0,
      costPrice: v.costPrice || 0,
      price: Number(form.price) + (v.priceAdjustment || 0),
      discount: v.discount ?? null,
      images: v.image ? [v.image] : [],
      mainImage: v.image || "",
    });
  };

  // ── Helpers ──
  const field = (key, { uppercase = false } = {}) => ({
    value: form[key],
    onChange: (e) => {
      const value = uppercase ? e.target.value.toUpperCase() : e.target.value;
      setForm((c) => ({ ...c, [key]: value }));
    },
  });
  const vField = (key, { uppercase = false } = {}) => ({
    value: variantForm[key] ?? "",
    onChange: (e) => {
      const value = uppercase ? e.target.value.toUpperCase() : e.target.value;
      setVariantForm((c) => ({ ...c, [key]: value }));
    },
  });

  const inputCls =
    "border border-gray-200 px-4 py-3 bg-white text-black text-sm focus:border-black focus:outline-none w-full transition-colors";
  const labelCls =
    "text-[10px] font-bold uppercase tracking-widest text-gray-500 flex flex-col gap-1.5";
  const cardCls = "bg-white border border-gray-200 p-6 grid gap-5 rounded-md";
  const headingCls =
    "text-xs font-bold uppercase tracking-widest text-black pb-4 border-b border-gray-100 m-0";

  const level1Categories = categories.filter((c) => !c.parentId);
  const level2Categories = selectedLevel1Id
    ? categories.filter((c) => c.parentId?._id === selectedLevel1Id)
    : [];
  const level3Categories = selectedLevel2Id
    ? categories.filter((c) => c.parentId?._id === selectedLevel2Id)
    : [];

  const groupedVariants = useMemo(() => {
    const map = new Map();
    variants.forEach((v) => {
      const color = v.color || "Không xác định";
      if (!map.has(color)) map.set(color, []);
      map.get(color).push(v);
    });
    map.forEach((items, color) => {
      map.set(color, sortVariantsBySize(items));
    });
    return map;
  }, [variants]);

  return (
    <section className="grid gap-0">
      {/* Header */}
      <div className="p-6">
        <AdminPageHeader
          title={editId ? "SỬA SẢN PHẨM" : "THÊM SẢN PHẨM MỚI"}
          description={`Sản phẩm / ${editId ? "Chỉnh sửa" : "Thêm mới"}`}
          aside={
            <button
              type="button"
              onClick={() => navigate("/admin/products/list")}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-md text-black bg-white border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-2 rounded-lg"
            >
              <ArrowLeft size={16} />
              Quay lại
            </button>
          }
        />
      </div>

      <form id="product-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-6 px-6 pb-6">
          {/* LEFT COL */}
          <div className="grid gap-6 content-start">
            {/* Basic info */}
            <div className={cardCls}>
              <h2 className={headingCls}>Thông tin cơ bản</h2>
              <label className={labelCls}>
                Tên sản phẩm *
                <input
                  className={inputCls}
                  required
                  placeholder="Vd: Áo thun oversize basic"
                  {...field("name")}
                />
              </label>
              <label className={labelCls}>
                Mô tả sản phẩm
                <textarea
                  className={inputCls}
                  rows="8"
                  placeholder="Mô tả chi tiết..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, description: e.target.value }))
                  }
                />
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <label className={labelCls}>
                  Chất liệu
                  <input
                    className={inputCls}
                    placeholder="Vd: Cotton, Polyester, Linen..."
                    {...field("material")}
                  />
                </label>
                <label className={labelCls}>
                  Giới tính
                  <select className={inputCls} {...field("gender")}>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </label>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {/* LEVEL 1 */}
                <label className={labelCls}>
                  Danh mục cấp 1 *
                  <select
                    className={inputCls}
                    value={selectedLevel1Id}
                    onChange={(e) => {
                      const id = e.target.value;

                      setSelectedLevel1Id(id);
                      setSelectedLevel2Id("");

                      const children = categories.filter(
                        (c) => c.parentId?._id === id,
                      );

                      setForm((c) => ({
                        ...c,
                        categoryId: children.length === 0 ? id : "",
                      }));
                    }}
                  >
                    <option value="">Chọn cấp 1...</option>

                    {level1Categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* LEVEL 2 */}
                <label className={labelCls}>
                  Danh mục cấp 2
                  <select
                    className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
                    disabled={!selectedLevel1Id}
                    value={selectedLevel2Id}
                    onChange={(e) => {
                      const id = e.target.value;

                      const children = categories.filter(
                        (c) => c.parentId?._id === id,
                      );

                      setSelectedLevel2Id(id);

                      setForm((c) => ({
                        ...c,
                        categoryId: children.length === 0 ? id : "",
                      }));
                    }}
                  >
                    <option value="">
                      {!selectedLevel1Id
                        ? "Chọn danh mục cấp 1 trước"
                        : "Chọn cấp 2..."}
                    </option>

                    {level2Categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* LEVEL 3 */}
                <label className={labelCls}>
                  Danh mục cấp 3
                  <select
                    className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
                    disabled={!selectedLevel2Id}
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        categoryId: e.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {!selectedLevel2Id
                        ? "Chọn danh mục cấp 2 trước"
                        : "Chọn cấp 3..."}
                    </option>

                    {level3Categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Initial Variants (Only show when creating new product) */}
            {!editId && (
              <div className={cardCls}>
                <>
                  <h2 className={headingCls}>Thông tin bán hàng</h2>

                  <div className="grid gap-5">
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* ROW 1 */}
                      <label className={labelCls}>
                        Màu sắc *
                        <input
                          className={inputCls}
                          required
                          placeholder="Đỏ, Vàng, Đen,..."
                          {...field("color")}
                        />
                      </label>

                      <label className={labelCls}>
                        Giá bán (VND) *
                        <div className="relative">
                          <input
                            className={inputCls + " pr-10"}
                            type="number"
                            min="0"
                            required
                            placeholder="0"
                            {...field("price")}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
                            ₫
                          </span>
                        </div>
                      </label>

                      <label className={labelCls}>
                        Giá nhập (VND)
                        <div className="relative">
                          <input
                            className={inputCls + " pr-10"}
                            type="number"
                            min="0"
                            placeholder="0"
                            {...field("costPrice")}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
                            ₫
                          </span>
                        </div>
                      </label>

                      {/* ROW 2 */}
                      <label className={labelCls}>
                        Kích cỡ *
                        <input
                          className={inputCls}
                          required
                          placeholder="S, M, L, XL"
                          {...field("sizes", { uppercase: true })}
                        />
                      </label>

                      <label className={labelCls}>
                        Giảm giá (%)
                        <div className="relative">
                          <input
                            className={inputCls + " pr-10"}
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={form.discount || ""}
                            onChange={(e) =>
                              setForm((c) => ({
                                ...c,
                                discount:
                                  e.target.value === "" ? 0 : Number(e.target.value),
                              }))
                            }
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
                            %
                          </span>
                        </div>
                      </label>

                      {/* ROW 3 */}
                      <label className={labelCls}>
                        Tồn kho mỗi size *
                        <input
                          className={inputCls}
                          required
                          type="number"
                          min="0"
                          placeholder="0"
                          value={form.stock || ""}
                          onChange={(e) =>
                            setForm((c) => ({
                              ...c,
                              stock: e.target.value === "" ? 0 : Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>

                    {form.price && Number(form.discount) > 0 && (
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border border-gray-200">
                        <span className="text-xs text-gray-500 uppercase tracking-widest">
                          Giá sau giảm
                        </span>

                        <span className="text-sm font-bold text-black">
                          {Math.round(
                            Number(form.price) *
                            (1 - Number(form.discount) / 100),
                          ).toLocaleString("vi-VN")}
                          ₫
                        </span>
                      </div>
                    )}
                  </div>
                </>
              </div>
            )}
            {/* Classification */}
            <div className={cardCls}>
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-black m-0">
                    Thuộc tính
                  </h2>
                </div>
              </div>
              <div className="grid gap-6 mt-2">
                <label className={labelCls}>
                  Phong cách
                  <MultiSelectTags
                    options={styleOptions}
                    value={form.style}
                    onChange={(val) => setForm((c) => ({ ...c, style: val }))}
                  />
                </label>
                <label className={labelCls}>
                  Mùa
                  <MultiSelectTags
                    options={seasonOptions}
                    value={form.season}
                    onChange={(val) => setForm((c) => ({ ...c, season: val }))}
                  />
                </label>
                <label className={labelCls}>
                  Dịp mặc
                  <MultiSelectTags
                    options={occasionOptions}
                    value={form.occasion}
                    onChange={(val) => setForm((c) => ({ ...c, occasion: val }))}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT COL */}
          <div className="grid gap-6 content-start sticky top-24 h-fit">
            {/* Collection selector */}
            <div className={cardCls}>
              <h2 className={headingCls}>
                <span className="flex items-center gap-2">
                  <FolderOpen size={14} />
                  Bộ sưu tập
                </span>
              </h2>

              {/* Show current collections in edit mode */}
              {editId && productCollections.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0 mb-2">
                    Sản phẩm đang thuộc bộ sưu tập:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {productCollections.map((col) => (
                      <span
                        key={col._id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200"
                      >
                        <Tag size={10} />
                        {col.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {editId && productCollections.length === 0 && (
                <p className="text-[12px] text-gray-400 italic m-0 mb-3">
                  Sản phẩm chưa thuộc bộ sưu tập nào
                </p>
              )}

              {!editId && (
                <>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0 mb-2">
                    Chọn bộ sưu tập để thêm sản phẩm vào
                  </p>
                  <select
                    className={inputCls}
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                  >
                    <option value="">— Không có bộ sưu tập —</option>
                    {allCollections.map((col) => (
                      <option key={col._id} value={col._id}>
                        {col.name} ({col.products?.length || 0} sản phẩm)
                      </option>
                    ))}
                  </select>
                  {selectedCollectionId && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded">
                      <Tag size={12} className="text-emerald-600 shrink-0" />
                      <span className="text-[11px] font-medium text-emerald-700">
                        Sẽ thêm vào bộ sưu tập: {allCollections.find((c) => c._id === selectedCollectionId)?.name}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {!editId && (
              <div className={cardCls}>
                <h2 className={headingCls}>Bộ sưu tập ảnh</h2>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0">
                  Tải lên nhiều ảnh và chọn 1 ảnh làm đại diện (ảnh chính)
                </p>
                <MultiImageUpload
                  label=""
                  values={form.gallery}
                  onChange={(urls) => setForm((c) => ({ ...c, gallery: urls }))}
                  mainImage={form.mainImage}
                  onSetMain={(url) =>
                    setForm((c) => ({ ...c, mainImage: url }))
                  }
                />
              </div>
            )}

            <div className={cardCls}>
              <h2 className={headingCls}>Video sản phẩm</h2>
              <MultiVideoUpload
                label=""
                values={form.videos}
                onChange={(urls) => setForm((c) => ({ ...c, videos: urls }))}
              />
            </div>

            {editId && (
              <div className={cardCls}>
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-black m-0">
                    Ảnh Gallery ({galleryImages.length})
                  </h2>
                  {/* Nút dọn ảnh trùng - chỉ hiện khi có duplicate */}
                  {(() => {
                    const urls = galleryImages.map((i) => i.imageUrl);
                    const hasDup = urls.length !== new Set(urls).size;
                    return hasDup ? (
                      <button
                        type="button"
                        onClick={handleDeduplicateGallery}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 border-none cursor-pointer transition-colors"
                        title="Xóa các ảnh có URL trùng nhau"
                      >
                        ⚠ Dọn ảnh trùng
                      </button>
                    ) : null;
                  })()}
                </div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest m-0">
                  Ảnh hiển thị trong trang chi tiết
                </p>

                <div className="border border-dashed border-gray-300 p-4 grid gap-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelCls}>
                      Màu sắc (Tùy chọn)
                      <select
                        className={`${inputCls} min-w-[300px]`}
                        value={newGalleryColor}
                        onChange={(e) => setNewGalleryColor(e.target.value)}
                      >
                        <option value="">Tất cả màu</option>
                        {[...new Set(variants.map((v) => v.color))]
                          .filter(Boolean)
                          .map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <MultiImageUpload
                    label=""
                    values={newGalleryUrls}
                    onChange={(urls) => setNewGalleryUrls(urls)}
                  />
                  {newGalleryUrls.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddGallery}
                      className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 border-none cursor-pointer transition-colors"
                    >
                      + Thêm {newGalleryUrls.length} ảnh vào gallery{" "}
                      {newGalleryColor ? `(${newGalleryColor})` : ""}
                    </button>
                  )}
                </div>

                {galleryImages.length > 0 && (
                  <div className="mt-2 space-y-4">
                    {/* Group gallery images by color for better admin overview */}
                    {["", ...new Set(variants.map((v) => v.color))].map(
                      (color) => {
                        const imgs = galleryImages.filter(
                          (img) => (img.color || "") === color,
                        );
                        if (imgs.length === 0) return null;
                        return (
                          <div key={color || "all"}>
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-100 pb-1">
                              {color
                                ? `MÀU: ${color}`
                                : "ẢNH CHUNG (Tất cả màu)"}
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                              {imgs.map((img) => (
                                <div
                                  key={img._id}
                                  className={`border-2 ${img.isMain ? "border-black" : "border-gray-200"} bg-white overflow-hidden`}
                                >
                                  <div className="relative">
                                    <img
                                      src={img.imageUrl}
                                      alt=""
                                      className="w-full aspect-square object-cover"
                                    />
                                    {img.isMain && (
                                      <span className="absolute top-1 left-1 bg-black text-white text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">
                                        CHÍNH
                                      </span>
                                    )}
                                  </div>
                                  {/* Nút action luôn hiển thị — không cần hover */}
                                  <div className="flex border-t border-gray-200">
                                    {!img.isMain && (
                                      <button
                                        type="button"
                                        title="Đặt làm ảnh chính"
                                        onClick={() => handleSetMain(img._id)}
                                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black bg-white hover:bg-yellow-50 cursor-pointer border-none border-r border-gray-200 transition-colors"
                                      >
                                        <Star size={11} />
                                        Chính
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      title="Xóa ảnh (xóa cả trên Cloudinary)"
                                      onClick={() =>
                                        handleDeleteGallery(img._id)
                                      }
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-600 bg-white hover:bg-red-50 cursor-pointer border-none transition-colors"
                                    >
                                      <Trash2 size={11} />
                                      Xóa
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              form="product-form"
              type="submit"
              disabled={loading}
              className="w-full py-4 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer border-none disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                "ĐANG LƯU..."
              ) : editId ? (
                <>
                  <Save size={16} />
                  LƯU THAY ĐỔI
                </>
              ) : (
                <>
                  <Plus size={16} />
                  THÊM SẢN PHẨM
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── VARIANTS SECTION ── */}
      {editId && (
        <div className="border-t border-gray-200 p-8" ref={variantsRef}>
          <div className={cardCls}>
            <h2 className={headingCls}>
              Biến thể sản phẩm ({variants.length})
            </h2>

            {/* Add/edit variant form */}
            <form
              onSubmit={handleAddVariant}
              className="bg-gray-50 border border-gray-200 p-5 grid gap-5"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-black m-0">
                {editingVariantId ? "SỬA BIẾN THỂ" : "THÊM BIẾN THỂ MỚI"}
              </p>

              <div className="grid grid-cols-[1fr_1fr_320px] gap-3 items-stretch">
                {/* ROW 1 */}
                <label className={labelCls}>
                  Màu sắc *
                  <input
                    className={inputCls}
                    placeholder="Đen, Trắng..."
                    {...vField("color")}
                  />
                </label>

                <label className={labelCls}>
                  Kích cỡ *
                  <input
                    className={inputCls}
                    placeholder="S, M, L..."
                    {...vField("size", { uppercase: true })}
                  />
                </label>

                {/* IMAGE PREVIEW */}
                <div className="row-span-2 min-h-[170px]">
                  <MultiImageUpload
                    label="Ảnh biến thể"
                    values={variantForm.images}
                    onChange={(urls) =>
                      setVariantForm((c) => ({
                        ...c,
                        images: urls,
                        mainImage:
                          c.mainImage && urls.includes(c.mainImage)
                            ? c.mainImage
                            : urls[0] || "",
                      }))
                    }
                    mainImage={variantForm.mainImage}
                    onSetMain={(url) =>
                      setVariantForm((c) => ({ ...c, mainImage: url }))
                    }
                  />
                </div>

                {/* ROW 2 */}
                <label className={labelCls}>
                  Tồn kho
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={variantForm.stock || ""}
                    onChange={(e) =>
                      setVariantForm((c) => ({
                        ...c,
                        stock: e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className={labelCls}>
                  Giá nhập
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="1000"
                    placeholder={form.costPrice || "Giá nhập sản phẩm"}
                    {...vField("costPrice")}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && (variantForm.costPrice === "" || variantForm.costPrice == null)) {
                        if (form.costPrice) {
                          setVariantForm((c) => ({ ...c, costPrice: form.costPrice }));
                        }
                      }
                    }}
                  />
                </label>

                {/* ROW 3 */}
                <label className={labelCls}>
                  Giá sản phẩm
                  <input
                    className={inputCls}
                    type="number"
                    {...vField("price")}
                    placeholder={form.price ? `${form.price}` : "0"}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && (variantForm.price === "" || variantForm.price == null)) {
                        if (form.price) {
                          setVariantForm((c) => ({ ...c, price: form.price }));
                        }
                      }
                    }}
                  />
                </label>

                <label className={labelCls}>
                  Giảm giá (%)
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    max="100"
                    {...vField("discount")}
                  />
                </label>

                <div className="flex gap-2 items-end">
                  <button
                    type="submit"
                    className="flex-1 h-[46px] text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 border-none cursor-pointer transition-colors"
                  >
                    {editingVariantId ? "CẬP NHẬT" : "THÊM"}
                  </button>

                  {editingVariantId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVariantId("");
                        setVariantForm(initialVariantForm);
                      }}
                      className="h-[46px] px-6 text-xs font-bold uppercase tracking-widest text-black bg-white border border-black hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      HỦY
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Variants table grouped by color */}
            {variants.length > 0 ? (
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-center">
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-16">
                        Ảnh
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Màu sắc
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Kích cỡ
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        SKU
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Tồn kho
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Giá nhập
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Giảm giá
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Giá tiền
                      </th>
                      <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-32">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...groupedVariants.entries()].map(([color, items]) =>
                      items.map((v, idx) => (
                        <tr
                          key={v._id}
                          className={`text-center border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx === 0 ? "border-t-2 border-t-gray-200" : ""}`}
                        >
                          <td className="py-3 px-3">
                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                              {v.image ? (
                                <img
                                  src={v.image}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <div className="w-full h-full grid place-items-center text-[8px] text-gray-300 uppercase">
                                  N/A
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {idx === 0 ? (
                              <span className="font-bold text-black">
                                {color}
                              </span>
                            ) : (
                              <span className="text-gray-300">↳</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block border border-gray-300 px-3 py-1 text-xs font-bold text-black">
                              {v.size}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs text-gray-500 font-mono">
                            {v.sku}
                          </td>
                          <td
                            className={`py-3 px-3 font-bold ${v.stock <= 5 ? "text-red-600" : "text-black"}`}
                          >
                            {v.stock}
                          </td>
                          <td className="py-3 px-3 text-xs">
                            {v.costPrice
                              ? `${Number(v.costPrice).toLocaleString()}đ`
                              : "0đ"}
                          </td>
                          <td className="py-3 px-3 text-xs font-bold">
                            {(() => {
                              const productDiscount = Number(
                                form.discount || 0,
                              );
                              const variantDiscount = v.discount;
                              const effectiveDiscount =
                                variantDiscount !== null &&
                                  variantDiscount !== undefined
                                  ? Number(variantDiscount)
                                  : productDiscount;

                              if (effectiveDiscount === 0) {
                                return (
                                  <span className="text-gray-400">0%</span>
                                );
                              }

                              const isInherited =
                                variantDiscount === null ||
                                variantDiscount === undefined;
                              return (
                                <span
                                  className={
                                    isInherited
                                      ? "text-blue-600"
                                      : "text-green-600"
                                  }
                                >
                                  {effectiveDiscount}%
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3 text-xs font-bold text-black">
                            {(() => {
                              const base =
                                Number(form.price) + (v.priceAdjustment || 0);
                              const productDiscount = Number(
                                form.discount || 0,
                              );
                              const variantDiscount = v.discount;
                              const effectiveDiscount =
                                variantDiscount !== null &&
                                  variantDiscount !== undefined
                                  ? Number(variantDiscount)
                                  : productDiscount;
                              const final =
                                effectiveDiscount > 0
                                  ? Math.round(
                                    base * (1 - effectiveDiscount / 100),
                                  )
                                  : base;
                              return final.toLocaleString("vi-VN");
                            })()}
                            ₫
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex gap-1 justify-center">
                              <button
                                type="button"
                                title="Nhân bản"
                                onClick={() => handleCloneVariant(v)}
                                className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 cursor-pointer border-none bg-transparent transition-colors"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                title="Sửa"
                                onClick={() => handleEditVariant(v)}
                                className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 cursor-pointer border-none bg-transparent transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="Xóa"
                                onClick={() => handleDeleteVariant(v._id)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer border-none bg-transparent transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400 m-0">
                  Chưa có biến thể nào
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
