import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import { formatProductName } from "../../lib/productName.js";
import ImageUpload from "../../components/ImageUpload.jsx";

const initialForm = {
  name: "",
  description: "",
  price: 0,
  discount: 0,
  categoryId: "",
  gender: "",
  material: "",
  style: "casual",
  season: "all_season",
  occasion: "casual",
  imageUrl: "",
};

export default function AdminProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/categories", { token }),
      ]);

      setProducts(productResponse.data);
      setCategories(categoryResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const buildPayload = () => ({
    name: form.name,
    description: form.description,
    price: Number(form.price),
    discount: Number(form.discount),
    categoryId: form.categoryId,
    gender: form.gender,
    material: form.material,
    style: form.style,
    season: [form.season],
    occasion: [form.occasion],
    images: form.imageUrl ? [form.imageUrl] : [],
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (editingId) {
        await apiRequest(`/products/${editingId}`, {
          method: "PUT",
          token,
          body: buildPayload(),
        });
        setMessage("Đã cập nhật sản phẩm thành công!");
      } else {
        await apiRequest("/products", {
          method: "POST",
          token,
          body: buildPayload(),
        });
        setMessage("Đã thêm sản phẩm");
      }

      setForm(initialForm);
      setEditingId("");
      loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price || 0,
      discount: product.discount || 0,
      categoryId: product.categoryId?._id || "",
      gender: product.gender || "",
      material: product.material || "",
      style: product.style || "casual",
      season: product.season?.[0] || "all_season",
      occasion: product.occasion?.[0] || "casual",
      imageUrl: product.images?.[0] || "",
    });
  };

  const handleDelete = async (productId) => {
    try {
      await apiRequest(`/products/${productId}`, {
        method: "DELETE",
        token,
      });
      setMessage("Đã xóa sản phẩm");
      loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const inputClass =
    "border border-gray-300 px-4 py-3 bg-white text-black text-sm focus:border-black focus:outline-none w-full";
  const labelClass =
    "text-xs font-bold uppercase tracking-widest text-black flex flex-col gap-2";

  return (
    <section className="grid gap-6">
      <AdminPageHeader
        title="SẢN PHẨM"
        description="Quản lý danh sách sản phẩm cốt lõi."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">
        <form
          className="bg-white border border-gray-200 p-7 grid gap-5 sticky top-6"
          onSubmit={handleSubmit}
        >
          <h3 className="text-black text-sm m-0 mb-2 pb-4 border-b border-gray-200 font-bold uppercase tracking-widest">
            {editingId ? "SỬA SẢN PHẨM" : "THÊM SẢN PHẨM MỚI"}
          </h3>
          <label className={labelClass}>
            Tên sản phẩm
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label className={labelClass}>
            Mô tả
            <textarea
              className={inputClass}
              rows="3"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label className={labelClass}>
            Danh mục
            <select
              className={inputClass}
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
            >
              <option value="">Chọn danh mục</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Giá
              <input
                className={inputClass}
                type="number"
                value={form.price}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </label>
            <label className={labelClass}>
              Giảm giá
              <input
                className={inputClass}
                type="number"
                value={form.discount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    discount: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Giới tính
              <select
                className={inputClass}
                value={form.gender}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gender: event.target.value,
                  }))
                }
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </label>
            <label className={labelClass}>
              Phong cách
              <select
                className={inputClass}
                value={form.style}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    style: event.target.value,
                  }))
                }
              >
                <option value="casual">casual</option>
                <option value="minimal">minimal</option>
                <option value="streetwear">streetwear</option>
                <option value="elegant">elegant</option>
                <option value="sporty">sporty</option>
                <option value="vintage">vintage</option>
                <option value="smart_casual">smart_casual</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Mùa
              <input
                className={inputClass}
                value={form.season}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    season: event.target.value,
                  }))
                }
              />
            </label>
            <label className={labelClass}>
              Dịp
              <input
                className={inputClass}
                value={form.occasion}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    occasion: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label className={labelClass}>
            Chất liệu
            <input
              className={inputClass}
              value={form.material}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  material: event.target.value,
                }))
              }
            />
          </label>

          <ImageUpload
            label="ẢNH CHÍNH"
            value={form.imageUrl}
            onChange={(url) =>
              setForm((current) => ({ ...current, imageUrl: url }))
            }
          />

          {message ? (
            <p className="text-black bg-gray-100 px-4 py-3 font-bold text-xs uppercase tracking-widest border-l-4 border-black m-0">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="text-red-600 bg-red-50 px-4 py-3 font-bold text-xs uppercase tracking-widest border-l-4 border-red-600 m-0">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3 pt-4 border-t border-gray-200 mt-2">
            <button
              className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer border-none"
              type="submit"
            >
              {editingId ? "CẬP NHẬT" : "THÊM MỚI"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-black bg-white border border-black hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => {
                  setEditingId("");
                  setForm(initialForm);
                }}
              >
                HỦY
              </button>
            ) : null}
          </div>
        </form>

        <section className="bg-white border border-gray-200 p-7">
          <h3 className="text-black text-sm m-0 mb-6 pb-4 border-b border-gray-200 font-bold uppercase tracking-widest">
            DANH SÁCH SẢN PHẨM
          </h3>
          <div className="grid gap-0 divide-y divide-gray-100">
            {products.map((product) => (
              <div
                key={product._id}
                className="flex justify-between gap-4 py-4 items-center hover:bg-gray-50 transition-colors px-2"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <strong className="block text-black mb-1 text-sm">
                      {formatProductName(product.name)}
                    </strong>
                    <p className="m-0 text-xs text-gray-500 uppercase tracking-widest">
                      {product.categoryId?.name} · {product.style}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-black bg-white border border-black hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => handleEdit(product)}
                  >
                    SỬA
                  </button>
                  <button
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 border border-red-600 cursor-pointer transition-colors"
                    onClick={() => handleDelete(product._id)}
                  >
                    XÓA
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
