import { useEffect } from "react";

export default function PayPalCallbackPage() {
  useEffect(() => {
    const backendBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    const callbackUrl = `${backendBaseUrl}/payment/paypal/callback${window.location.search}`;
    window.location.replace(callbackUrl);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-base font-medium text-gray-800">Đang xử lý thanh toán PayPal...</p>
        <p className="mt-2 text-sm text-gray-500">Vui lòng chờ trong giây lát.</p>
      </div>
    </div>
  );
}
