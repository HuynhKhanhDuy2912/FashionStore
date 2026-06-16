import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import ImageUpload from "../../components/ImageUpload.jsx";
import { formatProductName } from "../../lib/productName.js";

const initialForm = {
  productId: "",
  size: "",
  color: "",
  sku: "",
  stock: 0,
  priceAdjustment: 0,
  image: "",
};

export default function AdminVariantsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [productResponse, variantResponse] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/product-variants", { token }),
      ]);
      setProducts(productResponse.data);
      setVariants(variantResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        ...form,
        stock: Number(form.stock),
        priceAdjustment: Number(form.priceAdjustment),
      };

      if (editingId) {
        await apiRequest(`/product-variants/${editingId}`, {
          method: "PUT",
          token,
          body: payload,
        });
        setMessage("Đã cập nhật biến thể thành công!");
      } else {
        await apiRequest("/product-variants", {
          method: "POST",
          token,
          body: payload,
        });
        setMessage("Đã thêm biến thể");
      }

      setForm(initialForm);
      setEditingId("");
      loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (variant) => {
    setEditingId(variant._id);
    setForm({
      productId: variant.productId?._id || "",
      size: variant.size || "",
      color: variant.color || "",
      sku: variant.sku || "",
      stock: variant.stock || 0,
      priceAdjustment: variant.priceAdjustment || 0,
      image: variant.image || "",
    });
  };

  const handleDelete = async (variantId) => {
    try {
      await apiRequest(`/product-variants/${variantId}`, {
        method: "DELETE",
        token,
      });
      setMessage("Đã xóa biến thể thành công!");
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
        title="BIẾN THỂ"
        description="Quản lý màu sắc, kích cỡ, tồn kho và mã SKU."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">
        <form
          className="bg-white border border-gray-200 p-7 grid gap-5 sticky top-6"
          onSubmit={handleSubmit}
        >
          <h3 className="text-black text-sm m-0 mb-2 pb-4 border-b border-gray-200 font-bold uppercase tracking-widest">
            {editingId ? "SỬA BIẾN THỂ" : "THÊM BIẾN THỂ MỚI"}
          </h3>
          <label className={labelClass}>
            Sản phẩm
            <select
              className={inputClass}
              value={form.productId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  productId: event.target.value,
                }))
              }
            >
              <option value="">Chọn sản phẩm</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {formatProductName(product.name)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Kích cỡ
              <input
                className={inputClass}
                value={form.size}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    size: event.target.value,
                  }))
                }
              />
            </label>
            <label className={labelClass}>
              Màu sắc
              <input
                className={inputClass}
                value={form.color}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label className={labelClass}>
            Mã SKU
            <input
              className={inputClass}
              value={form.sku}
              onChange={(event) =>
                setForm((current) => ({ ...current, sku: event.target.value }))
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Tồn kho
              <input
                className={inputClass}
                type="number"
                value={form.stock}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    stock: event.target.value,
                  }))
                }
              />
            </label>
            <label className={labelClass}>
              Điều chỉnh giá
              <input
                className={inputClass}
                type="number"
                value={form.priceAdjustment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priceAdjustment: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <ImageUpload
            label="ẢNH BIẾN THỂ"
            value={form.image}
            onChange={(url) =>
              setForm((current) => ({ ...current, image: url }))
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
            DANH SÁCH BIẾN THỂ
          </h3>
          <div className="grid gap-0 divide-y divide-gray-100">
            {variants.map((variant) => (
              <div
                key={variant._id}
                className="flex justify-between gap-4 py-4 items-center hover:bg-gray-50 transition-colors px-2"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                    {variant.image ? (
                      <img
                        src={variant.image}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <strong className="block text-black mb-1 text-sm">
                      {formatProductName(variant.productId?.name)}
                    </strong>
                    <p className="m-0 text-xs text-gray-500 uppercase tracking-widest">
                      {variant.color} - {variant.size} · Tồn kho:{" "}
                      <span
                        className={
                          variant.stock <= 5 ? "text-red-600 font-bold" : ""
                        }
                      >
                        {variant.stock}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-black bg-white border border-black hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => handleEdit(variant)}
                  >
                    SỬA
                  </button>
                  <button
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 border border-red-600 cursor-pointer transition-colors"
                    onClick={() => handleDelete(variant._id)}
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
