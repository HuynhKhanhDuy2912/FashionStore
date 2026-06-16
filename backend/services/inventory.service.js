import InventoryTransaction from "../models/InventoryTransaction.js";
import ProductVariant from "../models/ProductVariant.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

export const createTransaction = async (data) => {
  const transaction = new InventoryTransaction(data);
  await transaction.save();
  return transaction;
};

export const getInventoryList = async (filters = {}, pagination = {}) => {
  const {
    search = "",
    productId,
    categoryId,
    lowStock,
    outOfStock,
    sort = "-createdAt"
  } = filters;

  const { page = 1, limit = 50 } = pagination;
  const skip = (page - 1) * limit;

  let query = { isActive: true };

  if (productId) {
    query.productId = productId;
  }

  const variants = await ProductVariant.find(query)
    .populate({
      path: "productId",
      select: "name price discount images categoryId",
      populate: {
        path: "categoryId",
        select: "name"
      }
    })
    .sort(sort)
    .lean();

  let filtered = variants;

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (v) =>
        v.productId?.name?.toLowerCase().includes(searchLower) ||
        v.sku?.toLowerCase().includes(searchLower) ||
        v.color?.toLowerCase().includes(searchLower) ||
        v.size?.toLowerCase().includes(searchLower)
    );
  }

  if (categoryId) {
    filtered = filtered.filter(
      (v) => v.productId?.categoryId?._id?.toString() === categoryId
    );
  }

  if (lowStock === "true" || lowStock === true) {
    filtered = filtered.filter((v) => v.stock > 0 && v.stock <= 5);
  }

  if (outOfStock === "true" || outOfStock === true) {
    filtered = filtered.filter((v) => v.stock === 0);
  }

  const total = filtered.length;
  const paginatedData = filtered.slice(skip, skip + limit);

  return {
    data: paginatedData,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const getVariantInventory = async (variantId) => {
  const variant = await ProductVariant.findById(variantId)
    .populate({
      path: "productId",
      select: "name price discount images"
    })
    .lean();

  if (!variant) {
    throw new Error("Variant not found");
  }

  const transactions = await InventoryTransaction.find({ variantId })
    .populate("createdBy", "username fullname")
    .populate("orderId", "_id")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return {
    variant,
    transactions
  };
};

export const importStock = async (variantId, quantity, costPrice, userId, note = "") => {
  if (!variantId || !quantity || quantity <= 0) {
    throw new Error("Invalid import data");
  }

  if (costPrice !== undefined && costPrice < 0) {
    throw new Error("Cost price cannot be negative");
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant) {
    throw new Error("Variant not found");
  }

  const previousStock = variant.stock;
  const newStock = previousStock + quantity;

  await ProductVariant.findByIdAndUpdate(variantId, {
    stock: newStock,
    ...(costPrice !== undefined && { costPrice })
  });

  const transaction = await createTransaction({
    variantId,
    productId: variant.productId,
    type: "import",
    quantity,
    previousStock,
    newStock,
    costPrice: costPrice || variant.costPrice || 0,
    reason: "Nhập hàng",
    createdBy: userId,
    note
  });

  return transaction;
};

export const adjustStock = async (variantId, quantity, userId, reason, note = "") => {
  if (!variantId || quantity === undefined || quantity === 0) {
    throw new Error("Invalid adjustment data");
  }

  if (!reason) {
    throw new Error("Reason is required for stock adjustment");
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant) {
    throw new Error("Variant not found");
  }

  const previousStock = variant.stock;
  const newStock = previousStock + quantity;

  if (newStock < 0) {
    throw new Error("Stock cannot be negative");
  }

  await ProductVariant.findByIdAndUpdate(variantId, {
    stock: newStock
  });

  const transaction = await createTransaction({
    variantId,
    productId: variant.productId,
    type: "adjustment",
    quantity,
    previousStock,
    newStock,
    reason,
    createdBy: userId,
    note
  });

  return transaction;
};

export const getTransactionHistory = async (filters = {}, pagination = {}) => {
  const {
    variantId,
    productId,
    type,
    startDate,
    endDate
  } = filters;

  const { page = 1, limit = 50 } = pagination;
  const skip = (page - 1) * limit;

  let query = {};

  if (variantId) {
    query.variantId = variantId;
  }

  if (productId) {
    query.productId = productId;
  }

  if (type) {
    query.type = type;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const [transactions, total] = await Promise.all([
    InventoryTransaction.find(query)
      .populate({
        path: "variantId",
        select: "sku color size image"
      })
      .populate({
        path: "productId",
        select: "name images"
      })
      .populate("createdBy", "username fullname")
      .populate("orderId", "_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryTransaction.countDocuments(query)
  ]);

  return {
    data: transactions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const getLowStockVariants = async (threshold = 5) => {
  const variants = await ProductVariant.find({
    stock: { $lte: threshold, $gt: 0 },
    isActive: true
  })
    .populate("productId", "name images")
    .sort({ stock: 1 })
    .limit(50)
    .lean();

  return variants;
};

export const getOutOfStockVariants = async () => {
  const variants = await ProductVariant.find({
    stock: 0,
    isActive: true
  })
    .populate("productId", "name images")
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return variants;
};

export const getInventoryStats = async () => {
  const [
    totalVariants,
    lowStockCount,
    outOfStockCount,
    inventoryValueAgg
  ] = await Promise.all([
    ProductVariant.countDocuments({ isActive: true }),
    ProductVariant.countDocuments({ isActive: true, stock: { $lte: 5, $gt: 0 } }),
    ProductVariant.countDocuments({ isActive: true, stock: 0 }),
    ProductVariant.aggregate([
      { $match: { isActive: true, stock: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ["$stock", "$costPrice"] }
          }
        }
      }
    ])
  ]);

  return {
    totalVariants,
    lowStockCount,
    outOfStockCount,
    totalInventoryValue: inventoryValueAgg[0]?.totalValue || 0
  };
};
