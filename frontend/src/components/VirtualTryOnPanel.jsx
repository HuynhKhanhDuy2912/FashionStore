import { useEffect, useState } from "react";
import { Image as ImageIcon, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import { apiRequest } from "../lib/api.js";

export default function VirtualTryOnPanel({
  open,
  onClose,
  productId,
  productName,
  garmentImageUrl,
  category = "upper_body",
  token,
}) {
  const [personFile, setPersonFile] = useState(null);
  const [personPreview, setPersonPreview] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!personFile) {
      setPersonPreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(personFile);
    setPersonPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [personFile]);

  // Reset result and error when product changes
  useEffect(() => {
    setResultUrl("");
    setError("");
  }, [productId]);

  if (!open) return null;

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setError("");
    setResultUrl("");
    setPersonFile(file || null);
  };

  const handleSubmit = async () => {
    if (!personFile) {
      setError("Vui lòng tải lên ảnh toàn thân.");
      return;
    }

    if (!garmentImageUrl) {
      setError("Sản phẩm này chưa có ảnh để thử đồ.");
      return;
    }

    const formData = new FormData();
    formData.append("personImage", personFile);
    formData.append("garmentImageUrl", garmentImageUrl);
    formData.append("productId", productId);
    formData.append("category", category);

    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/virtual-try-on", {
        method: "POST",
        token,
        body: formData,
        isFormData: true,
        timeoutMs: 180000,
      });
      setResultUrl(response.data?.resultImageUrl || "");
    } catch (requestError) {
      setError(requestError.message || "Thử đồ ảo thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-sm border border-gray-200 bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="shrink-0 text-[#c58b45]" />
            <h3 className="m-0 text-sm font-bold uppercase tracking-widest text-black">
              Thử đồ ảo
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-0 text-black hover:text-gray-600"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <p className="mb-4 text-xs text-gray-500 line-clamp-2">
            {productName}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <ImageIcon size={13} />
                Sản phẩm
              </div>
              <div className="aspect-[3/4] overflow-hidden border border-gray-200 bg-gray-50">
                {garmentImageUrl ? (
                  <img
                    src={garmentImageUrl}
                    alt={productName}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    Chưa có ảnh
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Upload size={13} />
                Ảnh của bạn
              </div>
              <label className="relative block aspect-[3/4] cursor-pointer overflow-hidden border border-dashed border-gray-300 bg-gray-50 transition hover:border-black">
                {personPreview ? (
                  <img
                    src={personPreview}
                    alt="Ảnh người dùng"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-xs font-medium text-gray-500">
                    <Upload size={20} />
                    Tải ảnh
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 rounded-sm border border-[#c58b45]/30 bg-[#c58b45]/5 p-3 text-xs text-gray-700">
            <p className="font-bold text-[#c58b45] mb-1.5 flex items-center gap-1.5">
              <Sparkles size={13} />
              Mẹo để có kết quả tốt nhất:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-gray-600">
              <li>Chụp chính diện, rõ toàn thân hoặc nửa người, đủ sáng.</li>
              <li>Tránh tạo dáng phức tạp hoặc vung tay che khuất cơ thể.</li>
              <li>Nên mặc đồ ôm sát, mỏng nhẹ để AI ghép đồ tự nhiên hơn.</li>
              <li>Chọn phông nền đơn giản, ít chi tiết lộn xộn.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !personFile || !garmentImageUrl}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 border border-black bg-black px-4 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Đang xử lý
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Thử ngay
              </>
            )}
          </button>

          {error && (
            <p className="mt-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          {resultUrl && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Kết quả
              </div>
              <div className="overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={resultUrl}
                  alt="Kết quả thử đồ ảo"
                  className="w-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}