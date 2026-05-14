import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";

export default function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const message = searchParams.get("message");

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="mx-auto max-w-md px-4">
        <div className="bg-white border border-gray-200 p-8 text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-red-100">
            <X className="h-10 w-10 text-red-600" />
          </div>

          <h1 className="mb-2 text-2xl font-bold">Thanh toán thất bại!</h1>
          <p className="mb-6 text-gray-600">
            {message || "Đã có lỗi xảy ra trong quá trình thanh toán. Vui lòng thử lại."}
          </p>

          {orderId && (
            <div className="mb-6 border-t border-b border-gray-200 py-4">
              <p className="text-sm text-gray-600">Mã đơn hàng</p>
              <p className="font-mono text-lg font-semibold">{orderId}</p>
            </div>
          )}

          <div className="space-y-3">
            <Link
              to="/checkout"
              className="block w-full bg-black px-6 py-3 text-center text-sm font-bold uppercase text-white transition hover:bg-gray-800"
            >
              Thử lại
            </Link>
            <Link
              to="/"
              className="block w-full border border-gray-300 px-6 py-3 text-center text-sm font-medium transition hover:bg-gray-50"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
