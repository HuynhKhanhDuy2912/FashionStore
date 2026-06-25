import { useState, useRef } from "react";
import { UploadCloud, X, Loader2, Star } from "lucide-react";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function MultiImageUpload({ values = [], onChange, label = "ẢNH", mainImage = "", onSetMain }) {
  const { token } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate
    const invalidFiles = files.filter(f => !f.type.startsWith("image/"));
    if (invalidFiles.length > 0) {
      setError("Vui lòng chỉ chọn các tệp hình ảnh");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("image", file);

          const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
          const response = await fetch(`${API_BASE}/upload`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Tải ảnh thất bại");
          return data.imageUrl;
        })
      );

      const newValues = [...values, ...uploadedUrls];
      onChange(newValues);

      // Auto set main image if none is selected
      if (!mainImage && uploadedUrls.length > 0 && onSetMain) {
        onSetMain(uploadedUrls[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (e, urlToRemove) => {
    e.preventDefault();
    try {
      await apiRequest("/upload", {
        method: "DELETE",
        token,
        body: { imageUrl: urlToRemove }
      });
      const newValues = values.filter(url => url !== urlToRemove);
      onChange(newValues);
      if (mainImage === urlToRemove && onSetMain) {
        onSetMain(newValues.length > 0 ? newValues[0] : "");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-bold uppercase tracking-widest text-black">{label}</span>
      </div>

      {error && <p className="text-red-600 bg-red-50 px-3 py-2 font-bold text-xs uppercase tracking-widest border-l-2 border-red-600 m-0">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {values.map((url, idx) => (
          <div key={idx} className={`relative border-2 bg-gray-50 aspect-square group ${mainImage === url ? "border-black" : "border-gray-200"}`}>
            <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
            {mainImage === url && (
              <span className="absolute top-1 left-1 bg-black text-white text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">CHÍNH</span>
            )}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {mainImage !== url && onSetMain && (
                <button
                  type="button"
                  title="Đặt làm ảnh chính"
                  onClick={(e) => { e.preventDefault(); onSetMain(url); }}
                  className="p-1.5 bg-white hover:bg-yellow-50 cursor-pointer border-none"
                >
                  <Star size={14} className="text-black" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleRemove(e, url)}
                className="p-1.5 bg-white hover:bg-red-50 cursor-pointer border-none"
                title="Xóa ảnh"
              >
                <X size={14} className="text-red-600" />
              </button>
            </div>
          </div>
        ))}

        <label className="border border-gray-300 border-dashed hover:border-black bg-white transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer aspect-square max-w-[120px] max-h-[120px] w-full">
          <input
            type="file"
            accept="image/*"
            multiple
            className="absolute opacity-0 w-0 h-0"
            onChange={handleFileChange}
            ref={fileInputRef}
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin text-black" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-black mt-1">ĐANG TẢI...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-6 h-6 text-black" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-black mt-1">THÊM ẢNH</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}
