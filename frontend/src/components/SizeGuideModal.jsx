import { X, Ruler } from "lucide-react";

export default function SizeGuideModal({ open, onClose, sizeGuide }) {
  if (!open || !sizeGuide) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-[750px] max-h-[92vh] overflow-hidden bg-white shadow-2xl animate-[fadeInUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: "2px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black flex items-center justify-center">
              <Ruler size={18} className="text-white -rotate-[15deg]" />
            </div>
            <div>
              <h3 className="text-lg font-bold uppercase tracking-wide text-black m-0">
                Hướng dẫn chọn size
              </h3>
              {sizeGuide.title && (
                <p className="text-xs text-gray-400 mt-0.5 m-0 uppercase">{sizeGuide.title}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent text-black"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(92vh - 82px)" }}>
          {/* Measurement Image and Labels */}
          {(sizeGuide.measurementImage || (sizeGuide.measurementLabels && sizeGuide.measurementLabels.length > 0)) && (
            <div className="mb-4">
              {sizeGuide.measurementImage && (
                <div className="flex justify-center mb-6">
                  <img
                    src={sizeGuide.measurementImage}
                    alt="Measurement Guide"
                    className="max-h-[500px] object-contain"
                  />
                </div>
              )}

              {sizeGuide.measurementLabels && sizeGuide.measurementLabels.length > 0 && (
                <div className="flex flex-col items-center justify-center space-y-1">
                  {sizeGuide.measurementLabels.map((label, index) => (
                    <div key={index} className="text-[13px] text-gray-700">
                      <span className="font-bold uppercase">{label.key}/</span> {label.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Size Chart Table */}
          {sizeGuide.headers && sizeGuide.headers.length > 0 && (
            <div className="mb-6">
              <h4 className="text-[13px] font-bold text-black uppercase mb-3 border-b border-black inline-block pb-1">
                Thông số tham khảo ({sizeGuide.unit || "cm"})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-black text-white">
                      {sizeGuide.headers.map((h, i) => (
                        <th key={i} className="py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider border border-white">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizeGuide.rows && sizeGuide.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="bg-white">
                        <td className="py-3 px-3 text-center text-[15px] font-bold text-black border border-gray-200">
                          {row.size}
                        </td>
                        {row.values.map((val, cIdx) => (
                          <td key={cIdx} className="py-3 px-3 text-center text-[13px] font-semibold text-gray-800 border border-gray-200">
                            {val || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sizeGuide.note && (
            <div className="text-left text-[12px] font-medium italic text-gray-500 mt-2">
              * {sizeGuide.note}
            </div>
          )}

        </div>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
