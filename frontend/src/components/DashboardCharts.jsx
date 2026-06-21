import { useState } from "react";
import ReactApexChart from "react-apexcharts";
import { formatCompactCurrency, formatCurrency } from "../lib/adminStats.js";
import { formatProductName } from "../lib/productName.js";

const STATUS_COLORS = {
  pending: "#f59e0b",
  confirmed: "#1e90ff",
  shipping: "#6d28d9",
  completed: "#45c51a",
  cancelled: "#ff4d4f",
};

const STATUS_ORDER = ["pending", "confirmed", "shipping", "completed", "cancelled"];
const STATUS_DISPLAY_LABELS = {
  pending: "Chờ xác nhận",
  shipping: "Đang giao",
  confirmed: "Đang xử lý",
  completed: "Đã giao",
  cancelled: "Đã hủy",
};

const PAYMENT_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export function RevenueApexChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        Chưa có dữ liệu doanh thu
      </div>
    );
  }

  const categories = data.map((item) => item.label);
  const series = [
    { name: "Doanh thu", type: "column", data: data.map((item) => Math.round(item.revenue || 0)) },
    { name: "Số đơn", type: "line", data: data.map((item) => item.orders || 0) },
    { name: "Đơn hủy", type: "line", data: data.map((item) => item.refunds || 0) },
  ];

  const options = {
    chart: {
      type: "line",
      stacked: false,
      toolbar: { show: false },
      fontFamily: "inherit",
      parentHeightOffset: 0,
      animations: { enabled: false },
    },
    colors: ["#0f13f3ff", "#2de903ff", "#f00505ff"],
    stroke: { width: [0, 3, 2], curve: "smooth", dashArray: [0, 0, 5] },
    fill: {
      type: ["solid", "solid", "solid"],
      opacity: [1, 1, 1],
    },
    plotOptions: { bar: { columnWidth: data.length <= 2 ? "20%" : "42%", borderRadius: 4 } },
    dataLabels: { enabled: false },
    // Hiện marker cho 2 đường (Số đơn, Đơn hủy) để điểm đơn lẻ vẫn nhìn thấy
    markers: { size: [0, 5, 4], strokeWidth: 2, strokeColors: "#fff", hover: { sizeOffset: 2 } },
    legend: { show: false },
    grid: { borderColor: "#eef0f4", strokeDashArray: 4, padding: { left: 8, right: 8 } },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: "#94a3b8", fontSize: "12px" } },
    },
    yaxis: [
      {
        seriesName: "Doanh thu",
        labels: {
          formatter: (val) => formatCompactCurrency(val),
          style: { colors: "#94a3b8" },
        },
      },
      {
        seriesName: "Số đơn",
        opposite: true,
        labels: { formatter: (val) => Math.round(val), style: { colors: "#94a3b8" } },
      },
      { seriesName: "Số đơn", opposite: true, show: false },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val, { seriesIndex }) =>
          seriesIndex === 0 ? formatCurrency(val) : `${val}`,
      },
    },
  };

  const legendItems = [
    { label: "Doanh thu", color: "#0f13f3ff" },
    { label: "Số đơn", color: "#2de903ff" },
    { label: "Đơn hủy", color: "#f00505ff" },
  ];

  return (
    <div>
      <ReactApexChart options={options} series={series} type="line" height={360} />
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm font-medium text-slate-600">
        {legendItems.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

//Biểu đồ cột - đường doanh thu và số đơn
export function RevenueOrdersChart({ data = [], primaryColor = "#2563eb" }) {
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1);
  const maxOrders = Math.max(...data.map((item) => item.orders), 1);
  const tickEvery = Math.max(1, Math.floor(data.length / 6));
  const chartHeight = 208;
  const chartWidth = 1000;
  const pointGap = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
  const orderPoints = data.map((item, index) => {
    const x = data.length > 1 ? index * pointGap : chartWidth / 2;
    const y = chartHeight - (item.orders / maxOrders) * chartHeight;
    return { x, y };
  });
  const orderPath = orderPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
          Doanh thu
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 bg-emerald-500" />
          Số đơn
        </span>
      </div>

      <div className="relative h-64 border-b border-slate-200">
        <div className="absolute inset-0 flex items-end gap-1 pb-7 md:gap-1.5">
          {data.map((item, index) => {
            const height = Math.max((item.revenue / maxRevenue) * 100, item.revenue > 0 ? 4 : 0);
            const showLabel = index % tickEvery === 0 || index === data.length - 1;

            return (
              <div
                key={item.date}
                className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <div className="absolute -top-12 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg group-hover:block">
                  <p className="font-bold text-slate-900">{formatCurrency(item.revenue)}</p>
                  <p className="text-slate-500">{item.orders} đơn hàng</p>
                  <p className="text-slate-400">{item.label}</p>
                </div>
                <div
                  className="w-full max-w-[22px] rounded-t-sm transition-all hover:opacity-90"
                  style={{
                    height: `${height}%`,
                    backgroundColor: primaryColor,
                  }}
                />
                {showLabel ? (
                  <span className="absolute top-full mt-1 text-[9px] font-medium text-slate-500 md:text-[10px]">{item.label}</span>
                ) : null}
              </div>
            );
          })}
        </div>

        <svg
          className="pointer-events-none absolute inset-x-0 top-0 h-[208px] w-full overflow-visible"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={orderPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {orderPoints.map((point, index) => (
            <circle
              key={`${data[index]?.date || index}-orders`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      <div className="flex justify-between text-xs text-slate-500">
        <span className="font-medium">Giai đoạn: {data.length} ngày</span>
        <span className="font-semibold">
          Đỉnh: {formatCompactCurrency(maxRevenue)} · {maxOrders} đơn
        </span>
      </div>
    </div>
  );
}

//Biểu đồ tròn tiến độ xử lý đơn hàng
export function StatusDonutChart({ data = [] }) {
  const [activeStatus, setActiveStatus] = useState(null);
  const source = STATUS_ORDER.map((status) => {
    const item = data.find((entry) => entry.status === status);
    return {
      status,
      label: STATUS_DISPLAY_LABELS[status] || item?.label || status,
      count: item?.count || 0,
      color: STATUS_COLORS[status] || "#cbd5e1",
    };
  });
  const total = source.reduce((sum, item) => sum + item.count, 0);
  const activeItem = activeStatus
    ? source.find((item) => item.status === activeStatus)
    : null;
  const centerValue = activeItem ? activeItem.count : total;
  const centerLabel = activeItem ? activeItem.label : "Tổng đơn";
  const radius = 76;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 ? 10 : 0;
  let offset = 0;

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-7">
      <div className="group/chart relative grid h-56 w-56 place-items-center">
        <svg
          className="h-full w-full -rotate-90 overflow-visible"
          viewBox="0 0 220 220"
          aria-label="Biểu đồ trạng thái đơn hàng"
        >
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {total > 0
            ? source.map((item) => {
              const segmentLength =
                item.count > 0
                  ? Math.max((item.count / total) * circumference - gap, 2)
                  : 0;
              const dashOffset = -offset;
              offset += item.count > 0 ? segmentLength + gap : 0;
              const isActive = activeStatus === item.status;

              return (
                <circle
                  key={item.status}
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={isActive ? strokeWidth + 3 : strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={dashOffset}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    opacity: activeStatus && !isActive ? 0.42 : 1,
                    filter: isActive ? "drop-shadow(0 8px 14px rgba(15,23,42,0.18))" : "none",
                  }}
                  onMouseEnter={() => setActiveStatus(item.status)}
                  onMouseLeave={() => setActiveStatus(null)}
                />
              );
            })
            : null}
        </svg>

        <div className="absolute grid h-28 w-28 place-items-center rounded-full bg-white text-center shadow-xl shadow-slate-200/80 ring-1 ring-slate-100">
          <div>
            <p className="text-4xl font-bold text-slate-950">{centerValue}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {centerLabel}
            </p>
          </div>
        </div>

        {activeItem ? (
          <div
            className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs shadow-lg"
          >
            <p className="font-bold text-slate-950">{activeItem.label}</p>
            <p className="mt-0.5 text-slate-500">
              {activeItem.count} đơn hàng
            </p>
          </div>
        ) : null}
      </div>

      <div
        className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm"
        onMouseLeave={() => setActiveStatus(null)}
      >
        {source.map((item) => {
          const isActive = activeStatus === item.status;

          return (
            <button
              key={item.status}
              type="button"
              onMouseEnter={() => setActiveStatus(item.status)}
              onFocus={() => setActiveStatus(item.status)}
              onBlur={() => setActiveStatus(null)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium transition ${isActive ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50"
                }`}
              title={`${item.label}: ${item.count} đơn hàng`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
              <span className={`${isActive ? "inline" : "hidden"} font-bold`}>
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InventoryTreemapChart({ data = [], colorTheme = "blue" }) {
  if (data.length === 0) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        Chưa có dữ liệu tồn kho
      </div>
    );
  }

  const series = [
    {
      data: data.map((item) => ({
        x: item.name,
        y: item.totalValue,
      })),
    },
  ];

  const themeColors = colorTheme === "pink"
    ? ["#ec4899", "#db2777", "#be185d", "#f472b6", "#fb7185", "#f43f5e", "#e11d48", "#f9a8d4", "#9d174d", "#831843"]
    : ["#3b82f6", "#2563eb", "#1d4ed8", "#60a5fa", "#6366f1", "#4f46e5", "#818cf8", "#38bdf8", "#0369a1", "#1e3a8a"];

  const options = {
    chart: {
      type: "treemap",
      toolbar: { show: false },
      parentHeightOffset: 0,
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 800,
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      }
    },
    colors: themeColors,
    plotOptions: {
      treemap: {
        distributed: true,
        enableShades: false,
        useFillColorAsStroke: false,
      }
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["#fff"]
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: "13px",
        fontWeight: 600,
        fontFamily: "inherit",
        colors: ["#fff"]
      },
      formatter: function (text, op) {
        return [text, formatCurrency(op.value)];
      }
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (val) => formatCurrency(val)
      }
    }
  };

  return (
    <div className="flex justify-center -mt-2">
      <ReactApexChart options={options} series={series} type="treemap" width="100%" height={320} />
    </div>
  );
}

export function TopProductsTable({ data = [] }) {
  if (data.length === 0) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        Chưa có sản phẩm bán chạy
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
            <th className="rounded-l-lg px-5 py-4">Sản phẩm</th>
            <th className="px-5 py-4 text-right">Giá bán</th>
            <th className="px-5 py-4 text-center">Đã bán</th>
            <th className="rounded-r-lg px-5 py-4 text-right">Doanh thu</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item, index) => (
            <tr key={item.productId || item.name} className="transition hover:bg-slate-50/80">
              <td className="px-5 py-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={formatProductName(item.name) || "Sản phẩm"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-bold text-slate-400">
                        #{index + 1}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-950">
                      {formatProductName(item.name)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">ID: #{index + 1}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-right font-semibold text-slate-700">
                {formatCurrency(item.price)}
              </td>
              <td className="px-5 py-4 text-center">
                <span className="inline-flex min-w-10 justify-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  {item.quantity}
                </span>
              </td>
              <td className="px-5 py-4 text-right font-bold text-blue-700">
                {formatCurrency(item.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderStatusFunnelPanel({ data = [] }) {
  const STATUS_ROW_ORDER = ["pending", "confirmed", "shipping", "completed", "cancelled"];
  const STATUS_ROW_LABELS = {
    pending: "Chờ xác nhận",
    confirmed: "Đang xử lý",
    shipping: "Đang giao",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };

  const rows = STATUS_ROW_ORDER.map((status) => {
    const item = data.find((d) => d.status === status);
    return {
      status,
      label: STATUS_ROW_LABELS[status],
      count: item?.count || 0,
      color: STATUS_COLORS[status] || "#cbd5e1",
    };
  });

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-100">
          <svg className="h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-400">Chưa có đơn hàng</p>
      </div>
    );
  }

  return (
    <div>
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
        const barWidth = total > 0 ? Math.max((row.count / total) * 100, row.count > 0 ? 3 : 0) : 0;

        return (
          <div key={row.status} className="group rounded-lg px-1 py-3.5 transition-colors hover:bg-slate-50">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-sm font-semibold text-slate-700">{row.label}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-slate-900">{row.count}</span>
                <span className="w-9 text-right text-xs font-semibold text-slate-400">{pct}%</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${barWidth}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        );
      })}

      {/* Footer tổng */}
      <div className="mt-6 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng đơn</span>
        <span className="text-lg font-bold text-slate-950">{total.toLocaleString("vi-VN")}</span>
      </div>
    </div>
  );
}

export function MonthlyPerformancePanel({ overview = {} }) {
  const {
    revenueThisMonth = 0,
    revenueLastMonth = 0,
    revenueGrowthPercent = 0,
    ordersThisMonth = 0,
    ordersLastMonth = 0,
    orderGrowthPercent = 0,
    averageOrderValue = 0,
  } = overview;

  const metrics = [
    {
      label: "Doanh thu",
      current: revenueThisMonth,
      previous: revenueLastMonth,
      growth: revenueGrowthPercent,
      format: (val) => {
        const n = Number(val || 0);
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
        return n.toLocaleString("vi-VN");
      },
      suffix: " ₫",
      colorCurrent: "#6366f1",
      colorPrevious: "#c7d2fe",
    },
    {
      label: "Số đơn hàng",
      current: ordersThisMonth,
      previous: ordersLastMonth,
      growth: orderGrowthPercent,
      format: (val) => String(val || 0),
      suffix: "",
      colorCurrent: "#10b981",
      colorPrevious: "#a7f3d0",
    },
  ];

  const now = new Date();
  const currentMonthName = now.toLocaleDateString("vi-VN", { month: "long" });
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthName = prevMonth.toLocaleDateString("vi-VN", { month: "long" });

  return (
    <div className="space-y-5">
      {metrics.map((m) => {
        const maxVal = Math.max(m.current, m.previous, 1);
        const currentPct = Math.max((m.current / maxVal) * 100, m.current > 0 ? 6 : 0);
        const previousPct = Math.max((m.previous / maxVal) * 100, m.previous > 0 ? 6 : 0);
        const isPositive = m.growth >= 0;

        return (
          <div key={m.label} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700">{m.label}</h4>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${isPositive
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-red-50 text-red-700 ring-1 ring-red-200"
                  }`}
              >
                {isPositive ? "↑" : "↓"} {Math.abs(m.growth)}%
              </span>
            </div>

            {/* Current month */}
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold capitalize text-slate-600">
                  {currentMonthName}
                </span>
                <span className="font-bold text-slate-900">
                  {m.format(m.current)}{m.suffix}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200/60">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${currentPct}%`,
                    backgroundColor: m.colorCurrent,
                  }}
                />
              </div>
            </div>

            {/* Previous month */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium capitalize text-slate-400">
                  {prevMonthName}
                </span>
                <span className="font-semibold text-slate-500">
                  {m.format(m.previous)}{m.suffix}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200/60">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${previousPct}%`,
                    backgroundColor: m.colorPrevious,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* AOV summary */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3.5 ring-1 ring-indigo-100">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
            Giá trị đơn trung bình
          </p>
          <p className="mt-1 text-xl font-bold text-indigo-700">
            {Number(averageOrderValue || 0).toLocaleString("vi-VN")} ₫
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-100 ring-1 ring-indigo-200">
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function TopCategoriesBarChart({ data = [] }) {
  const maxQuantity = Math.max(...data.map((item) => item.quantity), 1);
  const colors = ["#6366f1", "#a5b4fc"];

  if (data.length === 0) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        Chưa có danh mục bán chạy
      </div>
    );
  }

  return (
    <div className="space-y-7 py-3">
      {data.map((item, index) => {
        const percent = Math.max((item.quantity / maxQuantity) * 78, 6);

        return (
          <div key={item.categoryId || item.name} className="grid grid-cols-[112px_1fr] items-center gap-4">
            <p className="truncate text-right text-sm font-semibold text-slate-600">
              {item.name}
            </p>
            <div
              className="relative h-8"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(148,163,184,0.16) 1px, transparent 1px)",
                backgroundSize: "56px 100%",
              }}
            >
              <div
                className="h-full rounded-r-md rounded-l-sm transition-all duration-500"
                style={{
                  width: `${percent}%`,
                  backgroundColor: colors[index % colors.length],
                }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 pl-2 text-sm font-bold text-indigo-600"
                style={{ left: `${percent}%` }}
              >
                {item.quantity}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
