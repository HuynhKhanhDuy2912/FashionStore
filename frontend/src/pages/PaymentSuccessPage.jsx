import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="mx-auto max-w-md px-4">
        <div className="bg-white border border-gray-200 p-8 text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-green-100">
            <Check className="h-10 w-10 text-green-600" />
          </div>

          <h1 className="mb-2 text-2xl font-bold">Thanh toán thành công!</h1>
          <p className="mb-6 text-gray-600">
            Đơn hàng của bạn đã được xác nhận và đang được xử lý.
          </p>

          {orderId && (
            <div className="mb-6 border-t border-b border-gray-200 py-4">
              <p className="text-sm text-gray-600">Mã đơn hàng</p>
              <p className="font-mono text-lg font-semibold">{orderId}</p>
            </div>
          )}

          <div className="space-y-3">
            <Link
              to="/orders"
              className="block w-full bg-black px-6 py-3 text-center text-sm font-bold uppercase text-white transition hover:bg-gray-800"
            >
              Xem đơn hàng
            </Link>
            <Link
              to="/"
              className="block w-full border border-gray-300 px-6 py-3 text-center text-sm font-medium transition hover:bg-gray-50"
            >
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
