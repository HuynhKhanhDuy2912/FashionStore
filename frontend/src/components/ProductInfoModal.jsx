import { X } from "lucide-react";

function formatStyleName(style) {
  const normalizedStyle = String(style || "").trim().replace(/_/g, " ");

  if (!normalizedStyle) return "";

  return normalizedStyle.charAt(0).toUpperCase() + normalizedStyle.slice(1);
}

function formatProductStyles(style) {
  const styles = Array.isArray(style)
    ? style
    : String(style || "")
      .split(",")
      .map((item) => item.trim());

  return styles.filter(Boolean).map(formatStyleName).join(", ");
}

export default function ProductInfoModal({ open, onClose, product }) {
  if (!open || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-sm border border-gray-200 bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <h3 className="m-0 text-xl font-bold uppercase text-[#c58b45]">
            Thông tin sản phẩm
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-0 text-black"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-[15px] leading-6 text-black">
          {product.description &&
            product.description
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, index) => <p key={index}>{line}</p>)}

          {product.material && (
            <p>
              <span className="text-black">Chất liệu:</span> {product.material}
            </p>
          )}

          <p>
            <span className="text-black">Phong cách:</span>{" "}
            <span>{formatProductStyles(product.style)}</span>
          </p>

          <p>
            <span className="text-black">Giới tính:</span>{" "}
            {product.gender === "female" ? "Nữ" : "Nam"}
          </p>

          <p>
            <span className="text-black">SKU:</span> {product._id.slice(-6).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
}
