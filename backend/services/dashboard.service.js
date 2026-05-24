import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";

const REVENUE_STATUSES = ["confirmed", "shipping", "completed"];
const STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const PAYMENT_LABELS = {
  cod: "COD",
  vnpay: "VNPay",
  momo: "MoMo",
  paypal: "PayPal",
};

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function fillDailySeries(rows, days = 30) {
  const map = new Map(rows.map((row) => [row._id, row]));
  const result = [];
  const today = startOfDay(new Date());

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    const row = map.get(key);

    result.push({
      date: key,
      label: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      revenue: row?.revenue || 0,
      orders: row?.orders || 0,
    });
  }

  return result;
}

function growthPercent(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function getAdminDashboardStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const chartStart = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));

  const revenueMatch = { status: { $in: REVENUE_STATUSES } };

  const [
    totalOrders,
    revenueOrders,
    completedOrders,
    pendingOrders,
    confirmedOrders,
    shippingOrders,
    cancelledOrders,
    last7DaysRevenueAgg,
    last7DaysOrdersAll,
    newUsersLast7Days,
    paidOrders,
    pendingPaymentOrders,
    revenueThisMonth,
    revenueLastMonth,
    ordersThisMonth,
    ordersLastMonth,
    revenueToday,
    ordersToday,
    revenueByDayRaw,
    ordersByStatus,
    ordersByPayment,
    topProducts,
    recentOrders,
    totalUsers,
    newUsersThisMonth,
    totalProducts,
    lowStockVariants,
    lowStockCount,
    outOfStockCount,
    inventoryValueAgg
  ] = await Promise.all([
    Order.countDocuments(),
    Order.aggregate([
      { $match: revenueMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalPrice" },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalPrice" },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ status: "confirmed" }),
    Order.countDocuments({ status: "shipping" }),
    Order.countDocuments({ status: "cancelled" }),
    Order.aggregate([
      { $match: { ...revenueMatch, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalPrice" },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Order.countDocuments({ paymentStatus: "paid" }),
    Order.countDocuments({
      status: { $nin: ["cancelled"] },
      paymentStatus: "pending",
    }),
    Order.aggregate([
      { $match: { ...revenueMatch, createdAt: { $gte: monthStart } } },
      { $group: { _id: null, revenue: { $sum: "$totalPrice" } } },
    ]),
    Order.aggregate([
      {
        $match: {
          ...revenueMatch,
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        },
      },
      { $group: { _id: null, revenue: { $sum: "$totalPrice" } } },
    ]),
    Order.countDocuments({ createdAt: { $gte: monthStart } }),
    Order.countDocuments({
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
    }),
    Order.aggregate([
      { $match: { ...revenueMatch, createdAt: { $gte: todayStart } } },
      { $group: { _id: null, revenue: { $sum: "$totalPrice" } } },
    ]),
    Order.countDocuments({ createdAt: { $gte: todayStart } }),
    Order.aggregate([
      {
        $match: {
          ...revenueMatch,
          createdAt: { $gte: chartStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $match: revenueMatch },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    OrderItem.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      { $match: { "order.status": { $in: REVENUE_STATUSES } } },
      {
        $group: {
          _id: "$productId",
          quantity: { $sum: "$quantity" },
          revenue: { $sum: { $multiply: ["$price", "$quantity"] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productId: "$_id",
          name: "$product.name",
          quantity: 1,
          revenue: 1,
        },
      },
    ]),
    Order.find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("userId", "username email fullname")
      .lean(),
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: monthStart } }),
    Product.countDocuments(),
    ProductVariant.find({ stock: { $lte: 10 } })
      .sort({ stock: 1 })
      .limit(6)
      .populate("productId", "name")
      .lean(),
    ProductVariant.countDocuments({ stock: { $lte: 10, $gt: 0 } }),
    ProductVariant.countDocuments({ stock: 0 }),
    ProductVariant.aggregate([
      { $match: { isActive: true, stock: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalInventoryValue: {
            $sum: { $multiply: ["$stock", "$costPrice"] }
          }
        }
      }
    ])
  ]);

  const recognizedRevenue = revenueOrders[0]?.revenue || 0;
  const recognizedCount = revenueOrders[0]?.count || 0;
  const completedRevenue = completedOrders[0]?.revenue || 0;
  const completedCount = completedOrders[0]?.count || 0;
  const monthRevenue = revenueThisMonth[0]?.revenue || 0;
  const prevMonthRevenue = revenueLastMonth[0]?.revenue || 0;
  const todayRevenue = revenueToday[0]?.revenue || 0;

  return {
    overview: {
      totalOrders,
      recognizedRevenue,
      recognizedOrders: recognizedCount,
      completedRevenue,
      completedOrders: completedCount,
      pendingOrders,
      confirmedOrders,
      shippingOrders,
      cancelledOrders,
      last7DaysRevenue: last7DaysRevenueAgg[0]?.revenue || 0,
      last7DaysOrders: last7DaysOrdersAll,
      newUsersLast7Days,
      paidOrders,
      pendingPaymentOrders,
      averageOrderValue:
        recognizedCount > 0
          ? Math.round(recognizedRevenue / recognizedCount)
          : 0,
      revenueThisMonth: monthRevenue,
      revenueLastMonth: prevMonthRevenue,
      revenueGrowthPercent: growthPercent(monthRevenue, prevMonthRevenue),
      ordersThisMonth,
      ordersLastMonth,
      orderGrowthPercent: growthPercent(ordersThisMonth, ordersLastMonth),
      revenueToday: todayRevenue,
      ordersToday,
    },
    catalog: {
      totalUsers,
      newUsersThisMonth,
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue: inventoryValueAgg[0]?.totalInventoryValue || 0
    },
    revenueChart: fillDailySeries(revenueByDayRaw, 30),
    orderStatusChart: ordersByStatus.map((item) => ({
      status: item._id,
      label: STATUS_LABELS[item._id] || item._id,
      count: item.count,
    })),
    paymentChart: ordersByPayment.map((item) => ({
      method: item._id || "unknown",
      label: PAYMENT_LABELS[item._id] || item._id || "Khác",
      count: item.count,
      revenue: item.revenue,
    })),
    topProducts,
    recentOrders,
    lowStockVariants: lowStockVariants.map((variant) => ({
      _id: variant._id,
      color: variant.color,
      size: variant.size,
      stock: variant.stock,
      productName: variant.productId?.name || "Sản phẩm",
    })),
  };
}
