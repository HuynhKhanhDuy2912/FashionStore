import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Package, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const awardedCoupons = searchParams.get("awardedCoupons") === "true";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (awardedCoupons) {
      toast.success(
        "Chúc mừng! Bạn đã nhận được mã giảm giá phần thưởng. Vui lòng kiểm tra mục Ưu đãi của tôi.",
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
        <div className="mb-6 flex justify-center">
          <CheckCircle className="h-20 w-20 text-green-500" />
        </div>

        <h1 className="text-2xl font-bold text-black mb-3 uppercase tracking-widest">
          THANH TOÁN THÀNH CÔNG
        </h1>

        <p className="text-gray-600 mb-6 text-sm">
          Đơn hàng của bạn đã được thanh toán thành công. Chúng tôi sẽ xử lý và giao hàng trong thời gian sớm nhất.
        </p>

        {orderId && (
          <div className="bg-gray-50 border border-gray-200 p-4 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">MÃ ĐƠN HÀNG</p>
            <p className="text-lg font-bold text-black">#{orderId.slice(-8).toUpperCase()}</p>
          </div>
        )}

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
