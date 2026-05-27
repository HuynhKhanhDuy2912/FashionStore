import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import ImageUpload from "../../components/ImageUpload.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const initialForm = {
  title: "",
  imageUrl: "",
  collectionId: "",
  order: 0,
  isActive: true
};

export default function AdminBannersPage() {
  const { token } = useAuth();
  const [banners, setBanners] = useState([]);
  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");

  const loadBanners = async () => {
    try {
      const response = await apiRequest("/banners/admin/all", { token });
      setBanners(response.data || []);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const loadCollections = async () => {
    try {
      const response = await apiRequest("/collections?limit=100&isActive=true");
      setCollections(response.data || []);
    } catch (error) {
      toast.error("Lỗi khi tải bộ sưu tập");
    }
  };

  useEffect(() => {
    loadBanners();
    loadCollections();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.imageUrl) {
      toast.error("Vui lòng tải ảnh banner");
      return;
    }

    if (!form.collectionId) {
      toast.error("Vui lòng chọn bộ sưu tập");
      return;
    }

    try {
      const payload = {
        title: form.title,
        imageUrl: form.imageUrl,
        collectionId: form.collectionId,
        order: Number(form.order) || 0,
        isActive: Boolean(form.isActive)
      };

      if (editingId) {
        await apiRequest(`/banners/admin/${editingId}`, {
          method: "PUT",
          token,
          body: payload
        });
        toast.success("Đã cập nhật banner thành công!");
      } else {
        await apiRequest("/banners/admin", {
          method: "POST",
          token,
          body: payload
        });
        toast.success("Đã thêm banner mới");
      }

      setForm(initialForm);
      setEditingId("");
      loadBanners();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (banner) => {
    setEditingId(banner._id);
    setForm({
      title: banner.title || "",
      imageUrl: banner.imageUrl || "",
      collectionId: banner.collectionId?._id || "",
      order: banner.order || 0,
      isActive: Boolean(banner.isActive)
    });
  };

  const handleDelete = async (bannerId) => {
    try {
      await apiRequest(`/banners/admin/${bannerId}`, {
        method: "DELETE",
        token
      });
      toast.success("Đã xóa banner");
      loadBanners();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleToggleStatus = async (bannerId) => {
    try {
      await apiRequest(`/banners/admin/${bannerId}/toggle`, {
        method: "PATCH",
        token
      });
      toast.success("Đã cập nhật trạng thái banner");
      loadBanners();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleOrderUpdate = async (bannerId, nextOrder) => {
    try {
      await apiRequest(`/banners/admin/${bannerId}/order`, {
        method: "PATCH",
        token,
        body: { order: Number(nextOrder) || 0 }
      });
      loadBanners();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const inputClass =
    "border border-gray-300 px-4 py-3 bg-white text-black text-sm focus:border-black focus:outline-none w-full";
  const labelClass = "text-xs font-bold uppercase tracking-widest text-black flex flex-col gap-2";

  return (
    <section className="grid gap-4 p-6">
      <AdminPageHeader
        title="QUẢN LÝ BANNER"
        description="Quản lý banner trang chủ: upload ảnh, chọn bộ sưu tập, ẩn/hiện và sắp xếp thứ tự hiển thị."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">
        <form className="bg-white border border-gray-200 p-7 grid gap-5 sticky top-6" onSubmit={handleSubmit}>
          <h3 className="text-black text-sm m-0 mb-2 pb-4 border-b border-gray-200 font-bold uppercase">
            {editingId ? "SỬA BANNER" : "THÊM BANNER MỚI"}
          </h3>

          <label className={labelClass}>
            Tiêu đề
            <input
              className={inputClass}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ví dụ: Spring Summer 2026"
            />
          </label>

          <label className={labelClass}>
            Bộ sưu tập
            <select
              className={inputClass}
              value={form.collectionId}
              onChange={(event) => setForm((current) => ({ ...current, collectionId: event.target.value }))}
            >
              <option value="">-- Chọn bộ sưu tập --</option>
              {collections.map((collection) => (
                <option key={collection._id} value={collection._id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Thứ tự hiển thị
            <input
              type="number"
              className={inputClass}
              value={form.order}
              onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
            />
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-black">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4"
            />
            Hiển thị banner này
          </label>

          <ImageUpload
            label="ẢNH BANNER *"
            value={form.imageUrl}
            onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
          />

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
            DANH SÁCH BANNER
          </h3>

          <div className="grid gap-0 divide-y divide-gray-100">
            {banners.map((banner) => (
              <div
                key={banner._id}
                className="flex justify-between gap-4 py-4 items-center hover:bg-gray-50 transition-colors px-2"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-32 h-20 bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                    {banner.imageUrl ? (
                      <img src={banner.imageUrl} alt={banner.title || "Banner"} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-black mb-1 text-sm truncate">{banner.title || "(Không tiêu đề)"}</strong>
                    <p className="m-0 text-xs text-gray-500 uppercase tracking-widest truncate">
                      {banner.collectionId?.name || "Không có bộ sưu tập"}
                    </p>
                    <p className="m-0 mt-1 text-xs text-gray-500">Thứ tự: {banner.order}</p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 items-center">
                  <input
                    type="number"
                    defaultValue={banner.order}
                    className="w-12 border border-gray-300 px-2 py-2 text-xs"
                    onBlur={(event) => handleOrderUpdate(banner._id, event.target.value)}
                  />
                  <button
                    className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-blue-700 ${banner.isActive
                        ? "text-green-700 border-green-700 hover:bg-green-700 hover:text-white"
                        : "text-gray-600 border-gray-400 hover:bg-gray-600 hover:text-white"
                      }`}
                    onClick={() => handleToggleStatus(banner._id)}
                  >
                    {banner.isActive ? "HIỆN" : "ẨN"}
                  </button>
                  <button
                    className="flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                    onClick={() => handleEdit(banner)}
                  >
                    SỬA
                  </button>
                  <button
                    className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                    onClick={() => handleDelete(banner._id)}
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
