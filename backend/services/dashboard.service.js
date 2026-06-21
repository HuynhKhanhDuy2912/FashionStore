import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";

// Doanh thu chỉ ghi nhận khi đơn đã hoàn tất (giao thành công)
const REVENUE_STATUSES = ["completed"];
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
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const row = map.get(key);

    result.push({
      date: key,
      label: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      revenue: row?.revenue || 0,
      orders: row?.orders || 0,
      refunds: row?.refunds || 0,
    });
  }

  return result;
}

// Lấp đầy các tháng thiếu từ tháng có dữ liệu sớm nhất đến tháng hiện tại
function fillMonthlySeries(rows) {
  const map = new Map(rows.map((row) => [row._id, row]));
  const now = new Date();

  // Luôn hiển thị tối thiểu 12 tháng gần nhất để có khung biểu đồ; mở rộng thêm nếu
  // có dữ liệu cũ hơn 12 tháng.
  const minStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  let start = minStart;
  if (rows.length > 0) {
    const [y, m] = rows[0]._id.split("-").map(Number);
    const dataStart = new Date(y, m - 1, 1);
    if (dataStart < minStart) start = dataStart;
  }

  const result = [];
  const cursor = new Date(start);
  while (
    cursor.getFullYear() < now.getFullYear() ||
    (cursor.getFullYear() === now.getFullYear() &&
      cursor.getMonth() <= now.getMonth())
  ) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const row = map.get(key);

    result.push({
      month: key,
      label: `Th${m}/${String(y).slice(2)}`,
      revenue: row?.revenue || 0,
      orders: row?.orders || 0,
      refunds: row?.refunds || 0,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

function growthPercent(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function parseDateOnly(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export async function getAdminDashboardStats(filters = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999,
  );
  const chartStart = startOfDay(
    new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
  );
  const sevenDaysAgo = startOfDay(
    new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
  );

  const revenueMatch = { status: { $in: REVENUE_STATUSES } };
  const statusFrom = parseDateOnly(filters.statusFrom);
  const statusTo = parseDateOnly(filters.statusTo, true);
  const orderStatusMatch = {};
  if (statusFrom || statusTo) {
    orderStatusMatch.createdAt = {};
    if (statusFrom) orderStatusMatch.createdAt.$gte = statusFrom;
    if (statusTo) orderStatusMatch.createdAt.$lte = statusTo;
  }

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
    revenueByMonthRaw,
    ordersByStatus,
    inventoryMale,
    inventoryFemale,
    topProducts,
    topCategories,
    recentOrders,
    totalUsers,
    newUsersThisMonth,
    totalProducts,
    lowStockVariants,
    lowStockCount,
    outOfStockCount,
    inventoryValueAgg,
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
    // Chuỗi theo ngày (30 ngày gần nhất): tổng đơn, doanh thu (đơn hoàn tất), đơn hủy
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: chartStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "+07:00",
            },
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $in: ["$status", REVENUE_STATUSES] }, "$totalPrice", 0],
            },
          },
          refunds: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
              timezone: "+07:00",
            },
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $in: ["$status", REVENUE_STATUSES] }, "$totalPrice", 0],
            },
          },
          refunds: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      ...(Object.keys(orderStatusMatch).length
        ? [{ $match: orderStatusMatch }]
        : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ProductVariant.aggregate([
      { $match: { isActive: true, stock: { $gt: 0 } } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { "product.gender": "male" } },
      {
        $lookup: {
          from: "categories",
          localField: "product.categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$product.categoryId",
          name: { $first: { $ifNull: ["$category.name", "Chưa phân loại"] } },
          totalValue: { $sum: { $multiply: ["$stock", "$costPrice"] } },
          totalStock: { $sum: "$stock" },
        },
      },
      { $sort: { totalValue: -1 } },
    ]),
    ProductVariant.aggregate([
      { $match: { isActive: true, stock: { $gt: 0 } } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { "product.gender": "female" } },
      {
        $lookup: {
          from: "categories",
          localField: "product.categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$product.categoryId",
          name: { $first: { $ifNull: ["$category.name", "Chưa phân loại"] } },
          totalValue: { $sum: { $multiply: ["$stock", "$costPrice"] } },
          totalStock: { $sum: "$stock" },
        },
      },
      { $sort: { totalValue: -1 } },
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
      { $sort: { quantity: -1, revenue: -1 } },
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
          imageUrl: { $arrayElemAt: ["$product.images", 0] },
          price: {
            $cond: [
              { $gt: ["$quantity", 0] },
              { $round: [{ $divide: ["$revenue", "$quantity"] }, 0] },
              "$product.price",
            ],
          },
          quantity: 1,
          revenue: 1,
        },
      },
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
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$product.categoryId",
          name: { $first: { $ifNull: ["$category.name", "Chưa phân loại"] } },
          quantity: { $sum: "$quantity" },
          revenue: { $sum: { $multiply: ["$price", "$quantity"] } },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: 8 },
      {
        $project: {
          categoryId: "$_id",
          name: 1,
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
    ProductVariant.find({ stock: { $lte: 5 } })
      .sort({ stock: 1 })
      .limit(6)
      .populate("productId", "name")
      .lean(),
    ProductVariant.countDocuments({ stock: { $lte: 5, $gt: 0 } }),
    ProductVariant.countDocuments({ stock: 0 }),
    ProductVariant.aggregate([
      { $match: { isActive: true, stock: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalInventoryValue: {
            $sum: { $multiply: ["$stock", "$costPrice"] },
          },
        },
      },
    ]),
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
      totalInventoryValue: inventoryValueAgg[0]?.totalInventoryValue || 0,
    },
    revenueChart: fillDailySeries(revenueByDayRaw, 30),
    revenueMonthlyChart: fillMonthlySeries(revenueByMonthRaw),
    orderStatusChart: ordersByStatus.map((item) => ({
      status: item._id,
      label: STATUS_LABELS[item._id] || item._id,
      count: item.count,
    })),
    inventoryMale: inventoryMale.map((item) => ({
      categoryId: item._id,
      name: item.name,
      totalValue: item.totalValue,
      totalStock: item.totalStock,
    })),
    inventoryFemale: inventoryFemale.map((item) => ({
      categoryId: item._id,
      name: item.name,
      totalValue: item.totalValue,
      totalStock: item.totalStock,
    })),
    topProducts,
    topCategories,
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
