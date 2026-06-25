import { useState, useRef } from "react";
import { UploadCloud, X, Loader2 } from "lucide-react";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function ImageUpload({ value, onChange, label = "ẢNH" }) {
  const { token } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn một tệp hình ảnh");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
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

      if (!response.ok) {
        throw new Error(data.message || "Tải ảnh thất bại");
      }

      onChange(data.imageUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (e) => {
    e.preventDefault();
    if (!value) return;

    try {
      await apiRequest("/upload", {
        method: "DELETE",
        token,
        body: { imageUrl: value }
      });
      onChange("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-widest text-black">{label}</span>

      {error && <p className="text-red-600 bg-red-50 px-3 py-2 font-bold text-xs uppercase tracking-widest border-l-2 border-red-600 m-0">{error}</p>}

      {value ? (
        <div className="relative border border-gray-300 bg-gray-50 w-max h-40">
          <img src={value} alt="Preview" className="w-full h-full object-contain p-2" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-3 -right-3 bg-red-600 text-white p-1 border border-red-700 hover:bg-red-700 transition-colors cursor-pointer"
            title="Xóa ảnh"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label className="border border-gray-300 hover:border-black bg-white transition-colors p-6 flex flex-col items-center justify-center gap-2 cursor-pointer relative h-40">
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
            ref={fileInputRef}
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-black" />
              <span className="text-xs font-bold uppercase tracking-widest text-black">ĐANG TẢI LÊN...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-8 h-8 text-black" />
              <span className="text-xs font-bold uppercase tracking-widest text-black">NHẤN ĐỂ TẢI ẢNH LÊN</span>
            </>
          )}
        </label>
      )}
    </div>
  );
}
