import { X } from "lucide-react";

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Xác nhận", cancelText = "Hủy" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative rounded-md w-full max-w-md bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition hover:text-black"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-2 text-xl font-bold text-black">{title}</h2>
        <p className="mb-6 text-sm text-gray-600">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold uppercase rounded-md text-black transition hover:bg-black hover:text-white"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-red-600 px-4 py-2 text-[12px] font-bold uppercase rounded-md text-white transition hover:bg-red-800"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
