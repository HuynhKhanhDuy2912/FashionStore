import { formatCompactCurrency, formatCurrency } from "../../lib/adminStats.js";

const STATUS_COLORS = {
  pending: "#eab308",
  confirmed: "#3b82f6",
  shipping: "#8b5cf6",
  completed: "#10b981",
  cancelled: "#9ca3af",
};

const PAYMENT_COLORS = ["#111827", "#3b82f6", "#ec4899", "#f59e0b", "#6b7280"];

export function RevenueBarChart({ data = [], primaryColor = "#3874ff" }) {
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1);
  const tickEvery = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="space-y-4">
      <div className="flex h-52 items-end gap-1 border-b border-gray-100 pb-1 md:gap-1.5">
        {data.map((item, index) => {
          const height = Math.max((item.revenue / maxRevenue) * 100, item.revenue > 0 ? 6 : 0);
          const showLabel = index % tickEvery === 0 || index === data.length - 1;

          return (
            <div
              key={item.date}
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <div
                className="w-full max-w-[20px] rounded-t transition-all hover:opacity-80"
                style={{ height: `${height}%`, backgroundColor: primaryColor }}
                title={`${item.label}: ${formatCurrency(item.revenue)} · ${item.orders} đơn`}
              />
              {showLabel ? (
                <span className="text-[9px] text-gray-400 md:text-[10px]">{item.label}</span>
              ) : (
                <span className="text-[9px] text-transparent md:text-[10px]">.</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>30 ngày gần nhất</span>
        <span>Max: {formatCompactCurrency(maxRevenue)}</span>
      </div>
    </div>
  );
}

export function StatusDonutChart({ data = [] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0) || 1;

  const conicStops = [];
  let offset = 0;
  data.forEach((item) => {
    const percent = (item.count / total) * 100;
    const end = offset + percent;
    conicStops.push(`${STATUS_COLORS[item.status] || "#d1d5db"} ${offset}% ${end}%`);
    offset = end;
  });

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center">
      <div
        className="relative mx-auto grid h-40 w-40 shrink-0 place-items-center rounded-full"
        style={{
          background: conicStops.length
            ? `conic-gradient(${conicStops.join(", ")})`
            : "conic-gradient(#e5e7eb 0% 100%)",
        }}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
          <span className="text-2xl font-bold text-black">{total}</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            đơn
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[item.status] || "#d1d5db" }}
              />
              <span className="text-sm text-gray-700">{item.label}</span>
            </div>
            <div className="text-right">
              <span className="block text-sm font-bold text-black">{item.count}</span>
              <span className="text-xs text-gray-400">
                {((item.count / total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaymentBarList({ data = [] }) {
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1);

  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <p className="text-sm text-gray-400">Chưa có dữ liệu thanh toán</p>
      ) : (
        data.map((item, index) => (
          <div key={item.method}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{item.label}</span>
              <span className="font-bold text-black">{formatCurrency(item.revenue)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.revenue / maxRevenue) * 100}%`,
                  backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length],
                }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">{item.count} đơn hàng</p>
          </div>
        ))
      )}
    </div>
  );
}

export function TopProductsList({ data = [] }) {
  const maxQuantity = Math.max(...data.map((item) => item.quantity), 1);

  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <p className="text-sm text-gray-400">Chưa có sản phẩm bán chạy</p>
      ) : (
        data.map((item, index) => (
          <div key={item.productId || item.name} className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-black">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-black">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.quantity} sản phẩm đã bán</p>
                </div>
              </div>
              <span className="text-sm font-bold text-black">
                {formatCurrency(item.revenue)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-black"
                style={{ width: `${(item.quantity / maxQuantity) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
