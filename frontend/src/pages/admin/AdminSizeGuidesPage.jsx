import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, Save, X, Upload, Image as ImageIcon, Ruler, ChevronDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import toast from "react-hot-toast";

export default function AdminSizeGuidesPage() {
  const { token } = useAuth();
  const [sizeGuides, setSizeGuides] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null or sizeGuide object
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const emptyForm = {
    categoryId: "",
    title: "",
    measurementImage: "",
    measurementLabels: [],
    headers: ["Size"],
    rows: [],
    unit: "cm",
    note: "",
    isActive: true,
  };

  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [guidesRes, catsRes] = await Promise.all([
        apiRequest("/size-guides?limit=100", { token }),
        apiRequest("/categories?limit=100"),
      ]);
      setSizeGuides(guidesRes.data || []);
      setCategories(catsRes.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const usedCategoryIds = sizeGuides
    .filter((g) => !editing || g._id !== editing._id)
    .map((g) => (typeof g.categoryId === "object" ? g.categoryId._id : g.categoryId));

  const availableCategories = categories.filter(
    (c) => !usedCategoryIds.includes(c._id)
  );

  const handleNew = () => {
    setEditing({ _isNew: true });
    setForm({ ...emptyForm });
  };

  const handleEdit = (guide) => {
    setEditing(guide);
    setForm({
      categoryId: typeof guide.categoryId === "object" ? guide.categoryId._id : guide.categoryId,
      title: guide.title || "",
      measurementImage: guide.measurementImage || "",
      measurementLabels: guide.measurementLabels || [],
      headers: guide.headers?.length ? guide.headers : ["Size"],
      rows: guide.rows || [],
      unit: guide.unit || "cm",
      note: guide.note || "",
      isActive: guide.isActive ?? true,
    });
  };

  const handleCancel = () => {
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xoá bảng size này?")) return;
    try {
      await apiRequest(`/size-guides/${id}`, { method: "DELETE", token });
      toast.success("Đã xoá bảng size");
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await apiRequest("/upload", {
        method: "POST",
        token,
        body: formData,
        isFormData: true,
      });
      setForm((prev) => ({ ...prev, measurementImage: res.imageUrl || res.mediaUrl }));
      toast.success("Upload ảnh thành công");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Measurement labels
  const addLabel = () => {
    const nextKey = String.fromCharCode(65 + form.measurementLabels.length); // A, B, C...
    setForm((prev) => ({
      ...prev,
      measurementLabels: [...prev.measurementLabels, { key: nextKey, label: "" }],
    }));
  };

  const updateLabel = (index, field, value) => {
    setForm((prev) => {
      const labels = [...prev.measurementLabels];
      labels[index] = { ...labels[index], [field]: value };
      return { ...prev, measurementLabels: labels };
    });
  };

  const removeLabel = (index) => {
    setForm((prev) => ({
      ...prev,
      measurementLabels: prev.measurementLabels.filter((_, i) => i !== index),
    }));
  };

  // Headers
  const addHeader = () => {
    setForm((prev) => ({
      ...prev,
      headers: [...prev.headers, ""],
      rows: prev.rows.map((r) => ({ ...r, values: [...r.values, ""] })),
    }));
  };

  const updateHeader = (index, value) => {
    setForm((prev) => {
      const headers = [...prev.headers];
      headers[index] = value;
      return { ...prev, headers };
    });
  };

  const removeHeader = (index) => {
    if (index === 0) return; // Don't remove "Size"
    setForm((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
      rows: prev.rows.map((r) => ({
        ...r,
        values: r.values.filter((_, i) => i !== index - 1),
      })),
    }));
  };

  // Rows
  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        { size: "", values: Array(Math.max(0, prev.headers.length - 1)).fill("") },
      ],
    }));
  };

  const updateRow = (rowIndex, field, value, colIndex) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      if (field === "size") {
        rows[rowIndex] = { ...rows[rowIndex], size: value };
      } else {
        const values = [...rows[rowIndex].values];
        values[colIndex] = value;
        rows[rowIndex] = { ...rows[rowIndex], values };
      }
      return { ...prev, rows };
    });
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.categoryId) {
      toast.error("Vui lòng chọn danh mục");
      return;
    }
    setSaving(true);
    try {
      if (editing._isNew) {
        await apiRequest("/size-guides", { method: "POST", token, body: form });
        toast.success("Tạo bảng size thành công");
      } else {
        await apiRequest(`/size-guides/${editing._id}`, { method: "PUT", token, body: form });
        toast.success("Cập nhật bảng size thành công");
      }
      setEditing(null);
      setForm({ ...emptyForm });
      loadData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (guide) => {
    if (typeof guide.categoryId === "object") return guide.categoryId?.name || "—";
    const cat = categories.find((c) => c._id === guide.categoryId);
    return cat?.name || "—";
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wide">Quản lý bảng size</h1>
          <p className="mt-1 text-sm text-gray-500">
            Thiết lập bảng thông số size cho từng danh mục sản phẩm
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={handleNew}
            className="flex items-center gap-2 bg-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-gray-800 cursor-pointer border-none"
          >
            <Plus size={16} /> Thêm bảng size
          </button>
        )}
      </div>

      {/* ═══ EDIT FORM ═══ */}
      {editing && (
        <div className="mb-8 border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold">
              {editing._isNew ? "Tạo bảng size mới" : "Chỉnh sửa bảng size"}
            </h2>
            <button type="button" onClick={handleCancel} className="text-gray-500 hover:text-black cursor-pointer border-none bg-transparent">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-6 p-6">
            {/* Danh mục + Tiêu đề */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest">Danh mục *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                  disabled={!editing._isNew}
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-50"
                >
                  <option value="">Chọn danh mục</option>
                  {(editing._isNew ? availableCategories : categories).map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest">Tiêu đề</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="VD: SHIRT NAM / NỮ"
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Ảnh hướng dẫn đo */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest">
                Ảnh hướng dẫn đo
              </label>
              <div className="flex items-start gap-4">
                {form.measurementImage ? (
                  <div className="relative w-52 border border-gray-200 bg-gray-50 p-2">
                    <img
                      src={form.measurementImage}
                      alt="Measurement"
                      className="w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, measurementImage: "" }))}
                      className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center bg-red-500 text-white text-xs cursor-pointer border-none"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-40 w-52 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-black hover:text-black">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    {uploadingImage ? (
                      <div className="h-5 w-5 animate-spin border-2 border-black border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <ImageIcon size={24} />
                        <span className="text-xs font-bold uppercase">Upload ảnh</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Nhãn đo */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest">Nhãn đo (A, B, C...)</label>
                <button
                  type="button"
                  onClick={addLabel}
                  className="flex items-center gap-1 text-xs font-bold text-black hover:text-gray-600 cursor-pointer border-none bg-transparent"
                >
                  <Plus size={14} /> Thêm
                </button>
              </div>
              <div className="space-y-2">
                {form.measurementLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={label.key}
                      onChange={(e) => updateLabel(i, "key", e.target.value)}
                      className="w-14 border border-gray-300 px-3 py-2 text-sm text-center font-bold outline-none focus:border-black"
                      placeholder="A"
                    />
                    <input
                      type="text"
                      value={label.label}
                      onChange={(e) => updateLabel(i, "label", e.target.value)}
                      className="flex-1 border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                      placeholder="VD: Chiều dài áo"
                    />
                    <button
                      type="button"
                      onClick={() => removeLabel(i)}
                      className="text-gray-400 hover:text-red-500 cursor-pointer border-none bg-transparent"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Đơn vị + Ghi chú */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest">Đơn vị</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest">Ghi chú</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="VD: Thông số cân nặng đo theo đơn vị kg..."
                  className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Bảng thông số */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest">
                  Bảng thông số size
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addHeader}
                    className="flex items-center gap-1 text-xs font-bold text-black hover:text-gray-600 cursor-pointer border-none bg-transparent"
                  >
                    <Plus size={14} /> Thêm cột
                  </button>
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-1 text-xs font-bold text-black hover:text-gray-600 cursor-pointer border-none bg-transparent"
                  >
                    <Plus size={14} /> Thêm hàng
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      {form.headers.map((h, i) => (
                        <th key={i} className="border-r border-gray-200 px-2 py-2 last:border-r-0">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={h}
                              onChange={(e) => updateHeader(i, e.target.value)}
                              disabled={i === 0}
                              className="w-full border-none bg-transparent text-center text-xs font-bold uppercase outline-none disabled:text-gray-500"
                              placeholder="Header"
                            />
                            {i > 0 && (
                              <button
                                type="button"
                                onClick={() => removeHeader(i)}
                                className="shrink-0 text-gray-400 hover:text-red-500 cursor-pointer border-none bg-transparent p-0"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="w-10 bg-gray-100" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-t border-gray-200">
                        <td className="border-r border-gray-200 px-2 py-1">
                          <input
                            type="text"
                            value={row.size}
                            onChange={(e) => updateRow(rIdx, "size", e.target.value)}
                            className="w-full border-none bg-transparent text-center text-sm font-bold outline-none"
                            placeholder="S"
                          />
                        </td>
                        {row.values.map((val, cIdx) => (
                          <td key={cIdx} className="border-r border-gray-200 px-2 py-1 last:border-r-0">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => updateRow(rIdx, "value", e.target.value, cIdx)}
                              className="w-full border-none bg-transparent text-center text-sm outline-none"
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(rIdx)}
                            className="text-gray-400 hover:text-red-500 cursor-pointer border-none bg-transparent p-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {form.rows.length === 0 && (
                      <tr>
                        <td colSpan={form.headers.length + 1} className="py-6 text-center text-sm text-gray-400">
                          Chưa có dữ liệu. Nhấn "Thêm hàng" để bắt đầu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-widest">Trạng thái</label>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer border-none ${
                  form.isActive ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.isActive ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-sm text-gray-500">{form.isActive ? "Đang bật" : "Đã tắt"}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-black px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-gray-800 disabled:opacity-50 cursor-pointer border-none"
              >
                <Save size={14} />
                {saving ? "Đang lưu..." : "Lưu bảng size"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-600 transition hover:text-black cursor-pointer border border-gray-300 bg-white"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LIST ═══ */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin border-2 border-black border-t-transparent rounded-full" />
        </div>
      ) : sizeGuides.length === 0 && !editing ? (
        <div className="border border-gray-200 bg-white py-20 text-center">
          <Ruler size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">Chưa có bảng size nào</p>
          <button
            type="button"
            onClick={handleNew}
            className="mt-4 bg-black px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white cursor-pointer border-none hover:bg-gray-800"
          >
            Tạo bảng size đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sizeGuides.map((guide) => (
            <div key={guide._id} className="flex items-center justify-between border border-gray-200 bg-white px-6 py-4">
              <div className="flex items-center gap-4">
                {guide.measurementImage ? (
                  <img src={guide.measurementImage} alt="" className="h-16 w-16 object-contain border border-gray-100" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center border border-gray-200 bg-gray-50">
                    <Ruler size={20} className="text-gray-300" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold">{guide.title || getCategoryName(guide)}</p>
                  <p className="text-xs text-gray-500">
                    Danh mục: {getCategoryName(guide)} · {guide.rows?.length || 0} sizes · {guide.headers?.length || 0} cột
                  </p>
                  <span
                    className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                      guide.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {guide.isActive ? "Đang bật" : "Đã tắt"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(guide)}
                  className="flex items-center gap-1.5 border border-gray-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 transition hover:border-black hover:text-black cursor-pointer"
                >
                  <Edit3 size={13} /> Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(guide._id)}
                  className="flex items-center gap-1.5 border border-gray-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-500 transition hover:border-red-500 cursor-pointer"
                >
                  <Trash2 size={13} /> Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
