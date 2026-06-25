import { useRef, useState } from "react";
import { Video, Loader2, UploadCloud, X } from "lucide-react";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function MultiVideoUpload({ values = [], onChange, label = "VIDEO" }) {
  const { token } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const invalidFiles = files.filter((file) => !file.type.startsWith("video/"));
    if (invalidFiles.length > 0) {
      setError("Vui lòng chỉ chọn tệp video");
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
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Tải video thất bại");
          return data.mediaUrl || data.imageUrl;
        }),
      );

      onChange([...values, ...uploadedUrls]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (event, urlToRemove) => {
    event.preventDefault();
    try {
      await apiRequest("/upload", {
        method: "DELETE",
        token,
        body: { imageUrl: urlToRemove },
      });
      onChange(values.filter((url) => url !== urlToRemove));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-widest text-black">{label}</span>

      {error ? (
        <p className="m-0 border-l-2 border-red-600 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {values.map((url, index) => (
          <div key={`${url}-${index}`} className="group relative aspect-video overflow-hidden border border-gray-200 bg-gray-100">
            <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            <div className="absolute left-1 top-1 bg-black px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">
              Video
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => handleRemove(event, url)}
                className="border-none bg-white p-1.5 hover:bg-red-50"
                title="Xóa video"
              >
                <X size={14} className="text-red-600" />
              </button>
            </div>
          </div>
        ))}

        <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-gray-300 bg-white transition-colors hover:border-black">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="absolute h-0 w-0 opacity-0"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-black" />
              <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-black">Đang tải...</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-black" />
              <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-black">Thêm video</span>
            </>
          )}
        </label>
      </div>

      {!values.length ? (
        <div className="flex items-center gap-2 border border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Video size={14} />
          Chưa có video sản phẩm
        </div>
      ) : null}
    </div>
  );
}
