import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  PackageX,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import {
  PaymentBarList,
  RevenueBarChart,
  StatusDonutChart,
  TopProductsList,
} from "../../components/admin/DashboardCharts.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  fetchAdminDashboardStats,
  formatCurrency,
  formatPercent,
} from "../../lib/adminStats.js";
import { formatProductName } from "../../lib/productName.js";

const STATUS_BADGE = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  confirmed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  shipping: "bg-violet-50 text-violet-700 ring-violet-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

function AlertCard({ title, value, subtitle, icon: Icon, tone }) {
  const tones = {
    primary: "border-[#3874ff]/20 bg-[#3874ff]/5 text-[#3874ff]",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <article className="flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${tones[tone]}`}>
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </div>
      <div>
        <p className="text-3xl font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-2 text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
    </article>
  );
}

function MiniStat({ label, value, sublabel, trend }) {
  const isPositive = Number(trend) >= 0;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {trend !== undefined && trend !== null ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? "text-emerald-600" : "text-red-500"
              }`}
          >
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {formatPercent(trend)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-slate-500">{sublabel}</p> : null}
    </div>
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

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState("30");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAdminDashboardStats(token);
        setStats(data);
        setError("");
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const overview = stats?.overview;
  const catalog = stats?.catalog;

  const chartData = useMemo(() => {
    if (!stats?.revenueChart) return [];
    return chartRange === "7" ? stats.revenueChart.slice(-7) : stats.revenueChart;
  }, [stats, chartRange]);

  const completedPercent = useMemo(() => {
    if (!overview?.last7DaysOrders) return 0;
    const completed = stats?.orderStatusChart?.find((s) => s.status === "completed")?.count || 0;
    return Math.round((completed / overview.last7DaysOrders) * 100) || 0;
  }, [overview, stats]);

  const pendingPaymentPercent = overview?.last7DaysOrders
    ? Math.round((overview.pendingPaymentOrders / overview.totalOrders) * 100) || 0
    : 0;

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6 h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header — Phoenix style */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          Bảng điều khiển thương mại
        </h1>
        <p className="mt-1 text-sm text-slate-500 md:text-base">
          Đây là tình hình hoạt động cửa hàng của bạn ngay bây giờ
        </p>
      </header>

      {error ? (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {stats && overview ? (
        <>
          {/* Alert row */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <AlertCard
              title="Đơn chờ xử lý"
              value={overview.pendingOrders}
              subtitle="Đang chờ xác nhận"
              icon={ShoppingBag}
              tone="primary"
            />
            <AlertCard
              title="Đơn đã xác nhận"
              value={overview.confirmedOrders}
              subtitle="Chờ xuất kho / giao hàng"
              icon={Clock3}
              tone="warning"
            />
            <AlertCard
              title="Sản phẩm hết hàng"
              value={catalog?.outOfStockCount ?? 0}
              subtitle={`${catalog?.lowStockCount ?? 0} biến thể sắp hết`}
              icon={PackageX}
              tone="danger"
            />
          </div>

          {/* Main revenue + side stats */}
          <div className="mb-6 grid gap-6 xl:grid-cols-3">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Tổng doanh thu</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Thanh toán ghi nhận trên các kênh bán hàng
                  </p>
                </div>
                <div className="flex rounded-lg border border-slate-200 p-1">
                  {[
                    { value: "7", label: "7 ngày" },
                    { value: "30", label: "30 ngày" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChartRange(opt.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${chartRange === opt.value
                        ? "bg-[#3874ff] text-white"
                        : "text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-4 text-3xl font-bold text-slate-900">
                {formatCurrency(
                  chartRange === "7" ? overview.last7DaysRevenue : overview.recognizedRevenue,
                )}
              </p>
              <RevenueBarChart data={chartData} primaryColor="#3874ff" />
            </section>

            <div className="space-y-4">
              <MiniStat
                label="Tổng đơn hàng"
                value={overview.last7DaysOrders.toLocaleString("vi-VN")}
                sublabel="7 ngày qua"
                trend={overview.orderGrowthPercent}
              />
              <MiniStat
                label="Khách hàng mới"
                value={overview.newUsersLast7Days}
                sublabel="7 ngày qua"
                trend={overview.orderGrowthPercent}
              />
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hoàn thành vs chờ thanh toán
                </p>
                <p className="mt-2 text-sm text-slate-600">7 ngày qua</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600">Đã hoàn thành</span>
                      <span className="font-semibold text-slate-900">{completedPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${completedPercent}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600">Chờ thanh toán</span>
                      <span className="font-semibold text-slate-900">{pendingPaymentPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${pendingPaymentPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-bold text-slate-900">
                  {overview.completedOrders}
                  <span className="ml-1 text-sm font-normal text-slate-500">đơn hoàn tất</span>
                </p>
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Trạng thái đơn hàng</h3>
              <p className="mt-1 text-xs text-slate-500">Phân bổ toàn hệ thống</p>
              <div className="mt-4">
                <StatusDonutChart data={stats.orderStatusChart} />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Phương thức thanh toán</h3>
              <p className="mt-1 text-xs text-slate-500">Theo doanh thu ghi nhận</p>
              <div className="mt-4">
                <PaymentBarList data={stats.paymentChart} />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sản phẩm bán chạy</h3>
                  <p className="mt-1 text-xs text-slate-500">Top 5 theo số lượng</p>
                </div>
                <TrendingUp className="h-5 w-5 text-[#3874ff]" />
              </div>
              <div className="mt-4">
                <TopProductsList data={stats.topProducts} />
              </div>
            </section>
          </div>

          {/* Low stock + recent orders */}
          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm xl:col-span-1">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900">Tồn kho cần chú ý</h3>
                </div>
                <Link
                  to="/admin/inventory?filter=low-stock"
                  className="text-xs font-semibold text-[#3874ff] hover:underline"
                >
                  Xem tất cả →
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {stats.lowStockVariants.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">Kho hàng ổn định</p>
                ) : (
                  stats.lowStockVariants.map((variant) => (
                    <div
                      key={variant._id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {formatProductName(variant.productName)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {variant.color} · {variant.size}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold ${variant.stock === 0 ? "text-red-600" : "text-amber-600"
                          }`}
                      >
                        {variant.stock === 0 ? "Hết" : `Còn ${variant.stock}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Đơn hàng gần đây</h3>
                  <p className="text-xs text-slate-500">
                    Tổng {overview.totalOrders} đơn trong hệ thống
                  </p>
                </div>
                <Link
                  to="/admin/orders"
                  className="text-xs font-semibold text-[#3874ff] hover:underline"
                >
                  Xem tất cả →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="pb-3 pr-4">Khách hàng</th>
                      <th className="pb-3 pr-4">Thời gian</th>
                      <th className="pb-3 pr-4">Trạng thái</th>
                      <th className="pb-3 text-right">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.recentOrders.map((order) => (
                      <tr key={order._id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 pr-4">
                          <p className="font-medium text-slate-800">
                            {order.userId?.fullname || order.userId?.username || "Khách"}
                          </p>
                        </td>
                        <td className="py-3.5 pr-4 text-slate-500">
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="py-3.5 pr-4">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${STATUS_BADGE[order.status] || STATUS_BADGE.pending
                              }`}
                          >
                            {STATUS_LABEL[order.status] || order.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-semibold text-slate-900">
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
