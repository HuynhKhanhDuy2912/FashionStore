import { Bell, MessageCircleQuestion, ShoppingCart, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext.jsx";

function formatTimeAgo(value) {
  if (!value) return "Vừa xong";

  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

export default function AdminNotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markNotificationAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications]
  );

  const handleNavigate = async (item) => {
    if (!item) return;

    if (!item.isRead) {
      await markNotificationAsRead(item._id);
    }

    if (item.type === "order" && item.metadata?.orderId) {
      navigate(`/admin/orders/${item.metadata.orderId}`);
    } else if (item.type === "review" && item.metadata?.productId) {
      navigate(`/products/${item.metadata.productId}?review=true`);
    } else if (item.type === "question") {
      navigate("/admin/product-questions");
    }

    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-black hover:text-black"
        aria-label="Thông báo"
        title="Thông báo"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-[3px] -top-[3px] grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Đóng thông báo"
            className="fixed inset-0 z-30 cursor-default bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-12 z-40 w-[360px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-black">Thông báo</h3>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-blue-600 transition hover:text-blue-800"
                >
                  Đánh dấu đã đọc
                </button>
              ) : null}
            </div>

            <div
              className={`overflow-y-auto ${sortedNotifications.length > 5 ? "max-h-[340px]" : ""}`}
            >
              {sortedNotifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">Chưa có thông báo</div>
              ) : (
                sortedNotifications.map((item) => {
                  const isOrder = item.type === "order";
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleNavigate(item)}
                      className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${
                        item.isRead ? "bg-white" : "bg-blue-50/50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                          isOrder
                            ? "bg-emerald-100 text-emerald-700"
                            : item.type === "question"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {isOrder
                          ? <ShoppingCart className="h-4 w-4" />
                          : item.type === "question"
                            ? <MessageCircleQuestion className="h-4 w-4" />
                            : <Star className="h-4 w-4" />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 block text-xs font-semibold text-black">
                          {item.title || (isOrder ? "Đơn hàng mới" : "Bình luận mới")}
                        </span>
                        <span className="line-clamp-2 block text-xs text-gray-600">{item.message}</span>
                        <span className="mt-1 block text-[11px] text-gray-400">{formatTimeAgo(item.createdAt)}</span>
                      </span>

                      {!item.isRead ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
