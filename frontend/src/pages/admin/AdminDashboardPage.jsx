import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarDays,
  Clock,
  DollarSign,
  Flame,
  PackageX,
  ShoppingBag,
  TrendingUp,
  Users,
  Package,
  Clock3,
  Activity
} from "lucide-react";
import {
  MonthlyPerformancePanel,
  OrderStatusFunnelPanel,
  InventoryTreemapChart,
  RevenueApexChart,
  StatusDonutChart,
  TopCategoriesBarChart,
  TopProductsTable,
} from "../../components/DashboardCharts.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  fetchAdminDashboardStats,
  formatCompactCurrency,
  formatCurrency,
} from "../../lib/adminStats.js";
import { formatProductName } from "../../lib/productName.js";

const STATUS_BADGE = {
  pending: "bg-orange-50 text-orange-500 ring-orange-600/20",
  confirmed: "bg-blue-50 text-blue-500 ring-blue-600/20",
  shipping: "bg-violet-50 text-violet-500 ring-violet-600/20",
  completed: "bg-green-50 text-green-500 ring-green-600/20",
  cancelled: "bg-red-100 text-red-500 ring-red-500/20",
};

const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const STATUS_RANGE_OPTIONS = [
  { value: "today", label: "Hôm nay" },
  { value: "month", label: "Tháng này" },
];

function KPICard({
  title,
  value,
  icon: Icon,
  subtitle,
  colorScheme = "blue",
}) {
  const colorSchemes = {
    blue: {
      icon: "bg-blue-50 text-blue-700 ring-blue-200",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    purple: {
      icon: "bg-violet-50 text-violet-700 ring-violet-200",
    },
    orange: {
      icon: "bg-amber-50 text-amber-700 ring-amber-200",
    },
  };

  const scheme = colorSchemes[colorScheme];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md ring-1 ${scheme.icon}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function AlertCard({ title, value, subtitle, icon: Icon, tone, linkTo }) {
  const tones = {
    primary: "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  const content = (
    <>
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold leading-none text-slate-950">
          {value}
        </p>
        <p className="mt-2 text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
    </>
  );

  if (linkTo) {
    return (
      <Link to={linkTo}>
        <article className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
          {content}
        </article>
      </Link>
    );
  }

  return (
    <article className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {content}
    </article>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getMonthStartInputValue(date) {
  return toDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1));
}

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState("1Y");
  const [chartView, setChartView] = useState("month"); // "month" | "day"
  const [statusRange, setStatusRange] = useState("today");
  const [statusFrom, setStatusFrom] = useState(() => toDateInputValue(new Date()));
  const [statusTo, setStatusTo] = useState(() => toDateInputValue(new Date()));

  const statusDateFilters = useMemo(() => {
    const today = new Date();

    if (statusRange === "today") {
      const todayValue = toDateInputValue(today);
      return { statusFrom: todayValue, statusTo: todayValue };
    }

    if (statusRange === "month") {
      return {
        statusFrom: getMonthStartInputValue(today),
        statusTo: toDateInputValue(today),
      };
    }

    return {
      statusFrom: statusFrom || undefined,
      statusTo: statusTo || undefined,
    };
  }, [statusRange, statusFrom, statusTo]);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!stats) setLoading(true);
      try {
        const data = await fetchAdminDashboardStats(token, statusDateFilters);
        if (!ignore) {
          setStats(data);
          setError("");
        }
      } catch (loadError) {
        if (!ignore) setError(loadError.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();

    return () => {
      ignore = true;
    };
  }, [token, statusDateFilters]);

  const overview = stats?.overview;
  const catalog = stats?.catalog;

  const chartData = useMemo(() => {
    if (chartView === "day") {
      const all = stats?.revenueChart || [];
      const days = { "7D": 7, "14D": 14, "30D": 30 }[chartRange] || all.length;
      return all.slice(-days);
    }
    const all = stats?.revenueMonthlyChart || [];
    const months = { "1M": 1, "6M": 6, "1Y": 12, ALL: all.length }[chartRange] || all.length;
    return all.slice(-months);
  }, [stats, chartRange, chartView]);

  const revenueTotals = useMemo(
    () =>
      chartData.reduce(
        (acc, item) => ({
          orders: acc.orders + Number(item.orders || 0),
          earnings: acc.earnings + Number(item.revenue || 0),
          refunds: acc.refunds + Number(item.refunds || 0),
        }),
        { orders: 0, earnings: 0, refunds: 0 },
      ),
    [chartData],
  );


  const handleStatusFromChange = (value) => {
    setStatusRange("custom");
    setStatusFrom(value);
    if (value && statusTo && value > statusTo) setStatusTo(value);
  };

  const handleStatusToChange = (value) => {
    setStatusRange("custom");
    setStatusTo(value);
    if (value && statusFrom && value < statusFrom) setStatusFrom(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-72 animate-pulse rounded-md bg-slate-200" />
          <div className="h-4 w-96 animate-pulse rounded-md bg-slate-200" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-lg bg-white shadow-sm"
            />
          ))}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg bg-white shadow-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl uppercase">
            Tổng Quan Kinh Doanh
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi hiệu suất kinh doanh và vận hành cửa hàng thời trang
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:flex">
          <span className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold">
            Hôm nay: {formatCurrency(overview?.revenueToday || 0)}
          </span>
          <span className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold">
            {overview?.ordersToday || 0} đơn hôm nay
          </span>
        </div>
      </header>

      {error ? (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {stats && overview ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Tổng Doanh Thu"
              value={formatCurrency(overview.last7DaysRevenue)}
              subtitle="7 ngày qua"
              icon={DollarSign}
              colorScheme="blue"
            />
            <KPICard
              title="Đơn Hàng Mới"
              value={overview.last7DaysOrders}
              subtitle="7 ngày qua"
              icon={ShoppingBag}
              colorScheme="green"
            />
            <KPICard
              title="Khách Hàng Mới"
              value={overview.newUsersLast7Days}
              subtitle="7 ngày qua"
              icon={Users}
              colorScheme="purple"
            />
            <KPICard
              title="Tỷ Lệ Hoàn Thành"
              value={`${overview.totalOrders ? Math.round((overview.completedOrders / overview.totalOrders) * 100) : 0}%`}
              subtitle={`${overview.completedOrders} đơn hoàn tất`}
              icon={TrendingUp}
              colorScheme="orange"
            />
          </div>

          {/* Alert Cards - Cảnh báo vận hành */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <AlertCard
              title="Đơn chờ xác nhận"
              value={overview.pendingOrders}
              subtitle="Cần xử lý ngay"
              icon={Clock}
              tone="primary"
              linkTo="/admin/orders?status=pending"
            />
            <AlertCard
              title="Đơn đã xác nhận"
              value={overview.confirmedOrders}
              subtitle="Chờ xuất kho/giao hàng"
              icon={ShoppingBag}
              tone="warning"
              linkTo="/admin/orders?status=confirmed"
            />
            <AlertCard
              title="Sản phẩm hết hàng"
              value={catalog?.outOfStockCount ?? 0}
              subtitle={`${catalog?.lowStockCount ?? 0} biến thể sắp hết`}
              icon={PackageX}
              tone="danger"
              linkTo="/admin/inventory?filter=out-of-stock"
            />
          </div>

          {/* Main revenue chart + analytics */}
          <div className="mb-6 gap-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2 md:p-5">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-950 uppercase">Doanh thu</h2>
                  <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => { setChartView("month"); setChartRange("1Y"); }}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${chartView === "month" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Tháng
                    </button>
                    <button
                      type="button"
                      onClick={() => { setChartView("day"); setChartRange("30D"); }}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${chartView === "day" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      Ngày
                    </button>
                  </div>
                </div>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {(chartView === "month"
                    ? [
                      { value: "ALL", label: "ALL" },
                      { value: "1M", label: "1M" },
                      { value: "6M", label: "6M" },
                      { value: "1Y", label: "1Y" },
                    ]
                    : [
                      { value: "7D", label: "7 ngày" },
                      { value: "14D", label: "14 ngày" },
                      { value: "30D", label: "30 ngày" },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChartRange(opt.value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${chartRange === opt.value
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6 grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50">
                <div className="px-4 py-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">
                    {revenueTotals.orders.toLocaleString("vi-VN")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Số đơn</p>
                </div>
                <div className="px-4 py-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(revenueTotals.earnings)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Doanh thu</p>
                </div>
                <div className="px-4 py-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">
                    {revenueTotals.refunds.toLocaleString("vi-VN")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Đơn hủy</p>
                </div>
              </div>

              <RevenueApexChart data={chartData} />
            </section>
          </div>
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-md bg-indigo-50 p-2 ring-1 ring-indigo-200">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 uppercase">
                    Hiệu suất tháng
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    So sánh với tháng trước
                  </p>
                </div>
              </div>
              <MonthlyPerformancePanel overview={overview} />
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5 lg:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-md bg-indigo-50 p-2 ring-1 ring-indigo-200">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 uppercase">
                    Tồn kho Nam
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Vốn tồn đọng đồ nam
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <InventoryTreemapChart data={stats.inventoryMale || []} colorTheme="blue" />
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5 lg:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-md bg-pink-50 p-2 ring-1 ring-pink-200">
                  <DollarSign className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 uppercase">
                    Tồn kho Nữ
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Vốn tồn đọng đồ nữ
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <InventoryTreemapChart data={stats.inventoryFemale || []} colorTheme="pink" />
              </div>
            </section>
          </div>

          {/* Best sellers */}
          <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="rounded-md bg-orange-50 p-2 ring-1 ring-orange-200">
                  <Flame className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 uppercase">
                    Top 5 sản phẩm bán chạy
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Xếp hạng theo số lượng đã bán
                  </p>
                </div>
              </div>
              <div className="p-5">
                <TopProductsTable data={stats.topProducts} />
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="rounded-md bg-blue-50 p-2 ring-1 ring-blue-200">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 uppercase">
                    Top danh mục bán chạy
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Theo tổng số sản phẩm bán ra
                  </p>
                </div>
              </div>
              <div className="p-5">
                <TopCategoriesBarChart data={stats.topCategories || []} />
              </div>
            </section>
          </div>

          {/* Charts row - Status, Payment */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4 md:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-yellow-50 p-2 ring-1 ring-yellow-200">
                      <Clock3 className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-950 uppercase">
                        Tiến độ xử lý đơn hàng
                      </h3>
                      <p className="text-xs text-slate-500">
                        Phân bổ theo trạng thái trong mốc thời gian đã chọn
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                    <div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">
                      {STATUS_RANGE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setStatusRange(option.value)}
                          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${statusRange === option.value
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <span className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                      <input
                        type="date"
                        value={statusDateFilters.statusFrom || ""}
                        onChange={(event) => handleStatusFromChange(event.target.value)}
                        className="w-[128px] bg-transparent text-sm font-semibold text-slate-900 outline-none"
                        aria-label="Từ ngày"
                      />
                      <span className="text-slate-400">→</span>
                      <input
                        type="date"
                        value={statusDateFilters.statusTo || ""}
                        onChange={(event) => handleStatusToChange(event.target.value)}
                        className="w-[128px] bg-transparent text-sm font-semibold text-slate-900 outline-none"
                        aria-label="Đến ngày"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-5">
                <StatusDonutChart data={stats.orderStatusChart} />
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-orange-50 p-2 ring-1 ring-orange-200">
                    <Activity className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-950 uppercase">
                      Tình trạng vận hành
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Phân bổ đơn hàng theo trạng thái
                    </p>
                  </div>
                </div>
              </div>
              <OrderStatusFunnelPanel data={[
                { status: "pending", count: overview.pendingOrders },
                { status: "confirmed", count: overview.confirmedOrders },
                { status: "shipping", count: overview.shippingOrders },
                { status: "completed", count: overview.completedOrders },
                { status: "cancelled", count: overview.cancelledOrders },
              ]} />
            </section>
          </div>

          {/* Low stock alerts + Recent orders */}
          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1 md:p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-red-50 p-2 ring-1 ring-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-950 uppercase">
                      Cảnh báo tồn kho
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sản phẩm cần nhập thêm
                    </p>
                  </div>
                </div>
                <Link
                  to="/admin/inventory?filter=low-stock"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Xem tất cả
                </Link>
              </div>
              <div className="space-y-3">
                {stats.lowStockVariants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8">
                    <PackageX className="mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-400">
                      Kho hàng ổn định
                    </p>
                  </div>
                ) : (
                  stats.lowStockVariants.map((variant) => (
                    <div
                      key={variant._id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {formatProductName(variant.productName)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {variant.color} · {variant.size}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${variant.stock === 0
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                          }`}
                      >
                        {variant.stock === 0
                          ? "Hết hàng"
                          : `Còn ${variant.stock}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2 md:p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-green-50 p-2 ring-1 ring-green-200">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-950 uppercase">
                      Đơn hàng gần đây
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Tổng {overview.totalOrders} đơn trong hệ thống
                    </p>
                  </div>
                </div>
                <Link
                  to="/admin/orders"
                  className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold transition hover:bg-black hover:text-white"
                >
                  Xem tất cả đơn hàng →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="pb-3 pr-4">Khách hàng</th>
                      <th className="pb-3 pr-4">Thời gian</th>
                      <th className="pb-3 pr-4 text-center">Trạng thái</th>
                      <th className="pb-3 text-right">Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.recentOrders.map((order) => (
                      <tr
                        key={order._id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="py-4 pr-4">
                          <p className="font-semibold text-slate-800">
                            {order.userId?.fullname ||
                              order.userId?.username ||
                              "Khách"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {order.userId?.email?.slice(0, 25)}
                            {order.userId?.email?.length > 25 ? "..." : ""}
                          </p>
                        </td>
                        <td className="py-4 pr-4 text-slate-600">
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="py-4 pr-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${STATUS_BADGE[order.status] || STATUS_BADGE.pending
                              }`}
                          >
                            {STATUS_LABEL[order.status] || order.status}
                          </span>
                        </td>
                        <td className="py-4 text-right font-bold text-slate-900">
                          {formatCurrency(order.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
