import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Package, ArrowRight, Truck } from "lucide-react";
import toast from "react-hot-toast";

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const awardedCoupons = searchParams.get("awardedCoupons") === "true";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (awardedCoupons) {
      toast.success(
        "Chúc mừng! Bạn đã nhận được mã giảm giá phần thưởng. Vui lòng kiểm tra mục Mã giảm giá.",
        { id: "reward-coupon-toast", duration: 5000 }
      );
    }
  }, [awardedCoupons]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "/orders";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white border-2 border-green-500 p-8 text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <CheckCircle className="h-20 w-20 text-green-500" />
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
              <Truck className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-black mb-2 uppercase tracking-widest">
          ĐẶT HÀNG THÀNH CÔNG
        </h1>

        <p className="text-gray-500 text-sm mb-1 font-medium">Phương thức thanh toán</p>
        <p className="text-black font-bold mb-6">Thanh toán khi nhận hàng (COD)</p>

        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          Đơn hàng của bạn đã được đặt thành công. Chúng tôi sẽ liên hệ xác nhận và giao hàng trong thời gian sớm nhất.
        </p>

        {orderId && (
          <div className="bg-gray-50 border border-gray-200 p-4 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">MÃ ĐƠN HÀNG</p>
            <p className="text-lg font-bold text-black">#{orderId.slice(-8).toUpperCase()}</p>
          </div>
        )}

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-6 text-left">
          <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">Lưu ý COD</p>
          <p className="text-xs text-amber-600">
            Vui lòng chuẩn bị đúng số tiền khi nhận hàng. Bạn có thể kiểm tra hàng trước khi thanh toán.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/orders"
            className="flex items-center justify-center gap-2 bg-black text-white px-6 py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-800 transition-colors"
          >
            <Package className="h-4 w-4" />
            XEM ĐƠN HÀNG
          </Link>

          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-white text-black border border-black px-6 py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-50 transition-colors"
          >
            TIẾP TỤC MUA SẮM
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Tự động chuyển hướng sau {countdown} giây...
        </p>
      </div>
    </div>
  );
}
