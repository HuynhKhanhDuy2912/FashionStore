import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import ImageUpload from "../../components/ImageUpload.jsx";
import { formatProductName } from "../../lib/productName.js";

const initialForm = {
  productId: "",
  imageUrl: "",
  isMain: false,
};

export default function AdminProductImagesPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [productResponse, imageResponse] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/product-images", { token }),
      ]);
      setProducts(productResponse.data);
      setImages(imageResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.imageUrl) {
      setError("Vui lòng tải ảnh lên");
      return;
    }

    try {
      if (editingId) {
        await apiRequest(`/product-images/${editingId}`, {
          method: "PUT",
          token,
          body: form,
        });
        setMessage("Đã cập nhật ảnh sản phẩm");
      } else {
        await apiRequest("/product-images", {
          method: "POST",
          token,
          body: form,
        });
        setMessage("Đã thêm ảnh sản phẩm");
      }

      setForm(initialForm);
      setEditingId("");
      loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (image) => {
    setEditingId(image._id);
    setForm({
      productId: image.productId?._id || "",
      imageUrl: image.imageUrl || "",
      isMain: Boolean(image.isMain),
    });
  };

  const handleDelete = async (imageId) => {
    try {
      await apiRequest(`/product-images/${imageId}`, {
        method: "DELETE",
        token,
      });
      setMessage("Đã xóa ảnh sản phẩm");
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
        title="ẢNH SẢN PHẨM"
        description="Quản lý danh sách hình ảnh của sản phẩm."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">
        <form
          className="bg-white border border-gray-200 p-7 grid gap-5 sticky top-6"
          onSubmit={handleSubmit}
        >
          <h3 className="text-black text-sm m-0 mb-2 pb-4 border-b border-gray-200 font-bold uppercase tracking-widest">
            {editingId ? "SỬA ẢNH" : "THÊM ẢNH MỚI"}
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

          <ImageUpload
            label="ẢNH SẢN PHẨM"
            value={form.imageUrl}
            onChange={(url) =>
              setForm((current) => ({ ...current, imageUrl: url }))
            }
          />

          <label className="flex items-center gap-3 cursor-pointer py-2 text-black font-bold uppercase tracking-widest text-xs">
            <input
              type="checkbox"
              className="w-5 h-5 text-black rounded-none focus:ring-black border-gray-300"
              checked={form.isMain}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isMain: event.target.checked,
                }))
              }
            />
            <span>ĐẶT LÀM ẢNH CHÍNH</span>
          </label>
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
            DANH SÁCH ẢNH
          </h3>
          <div className="grid gap-0 divide-y divide-gray-100">
            {images.map((image) => (
              <div
                key={image._id}
                className="flex justify-between gap-4 py-4 items-center hover:bg-gray-50 transition-colors px-2"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                    {image.imageUrl ? (
                      <img
                        src={image.imageUrl}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <strong className="block text-black mb-1 text-sm">
                      {formatProductName(image.productId?.name)}
                    </strong>
                    <p className="m-0 text-xs font-bold mt-1 text-black uppercase tracking-widest">
                      {image.isMain ? "★ ẢNH CHÍNH" : "ẢNH PHỤ"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-black bg-white border border-black hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => handleEdit(image)}
                  >
                    SỬA
                  </button>
                  <button
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 border border-red-600 cursor-pointer transition-colors"
                    onClick={() => handleDelete(image._id)}
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
