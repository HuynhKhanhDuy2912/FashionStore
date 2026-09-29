import mongoose from "mongoose";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import OrderItem from "../models/OrderItem.js";
import { clearRecommendationCache } from "./hybridRecommendation.service.js";
import { attachGalleryImagesToProducts } from "./productImage.service.js";

const productPopulate = [{ path: "categoryId", select: "name" }];

export const createSlug = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const extractObjectId = (value = "") => {
  const directValue = String(value);
  if (/^[a-f\d]{24}$/i.test(directValue) && mongoose.Types.ObjectId.isValid(directValue)) return directValue;
  const match = String(value).match(/[a-f\d]{24}$/i);
  return match && mongoose.Types.ObjectId.isValid(match[0]) ? match[0] : null;
};

const applyPopulate = (query) => {
  productPopulate.forEach((item) => query.populate(item));
  return query;
};

export const buildProductFilters = (query = {}) => {
  const excludedKeys = ["page", "limit", "sort", "select"];
  const filters = {};

  Object.entries(query).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== undefined && value !== "") {
      filters[key] = value;
    }
  });

  // Always filter out deleted items unless specifically requested (admin only)
  if (filters.isDeleted === undefined) {
    filters.isDeleted = { $ne: true };
  } else if (filters.isDeleted === "true") {
    filters.isDeleted = true;
  } else if (filters.isDeleted === "false") {
    filters.isDeleted = { $ne: true };
  } else if (filters.isDeleted === "all") {
    delete filters.isDeleted;
  }

  return filters;
};

export const addComputedFields = async (products) => {
  const items = Array.isArray(products) ? products : [products];
  const ids = items.map((item) => item?._id).filter(Boolean);

  if (!ids.length) return Array.isArray(products) ? [] : products;

  const [soldRows, productsWithGalleryImages] = await Promise.all([
    OrderItem.aggregate([
      { $match: { productId: { $in: ids } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },
      { $match: { "order.status": { $ne: "cancelled" } } },
      { $group: { _id: "$productId", soldCount: { $sum: "$quantity" } } }
    ]),
    attachGalleryImagesToProducts(items)
  ]);

  const soldByProduct = new Map(soldRows.map((row) => [String(row._id), row.soldCount]));
  const decorated = productsWithGalleryImages.map((plain) => {
    return {
      ...plain,
      slug: plain.slug || createSlug(plain.name),
      soldCount: soldByProduct.get(String(plain._id)) || 0
    };
  });

  return Array.isArray(products) ? decorated : decorated[0];
};

export const listProducts = async (queryParams, user) => {
  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Math.max(Number(queryParams.limit) || 10, 1), 10000);
  const sort = queryParams.sort || { createdAt: -1 };
  const filters = buildProductFilters(queryParams);

  if (!user || user.role !== "admin") {
    filters.isActive = true;
  }

  const query = Product.find(filters)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  applyPopulate(query);

  const [items, total] = await Promise.all([
    query,
    Product.countDocuments(filters)
  ]);

  return {
    data: await addComputedFields(items),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const getProductById = async (identifier, user) => {
  const objectId = extractObjectId(identifier);
  const filters = objectId
    ? { _id: objectId }
    : { slug: createSlug(identifier) };

  if (!user || user.role !== "admin") {
    filters.isActive = true;
  }

  const query = Product.findOne(filters);
  applyPopulate(query);
  const item = await query;

  if (!item) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }

  return await addComputedFields(item);
};

export const updateProduct = async (productId, updateData) => {
  const item = await Product.findByIdAndUpdate(productId, updateData, {
    new: true,
    runValidators: true
  });

  if (!item) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }

  // Clear cache whenever a product is updated (especially isActive status)
  clearRecommendationCache();

  return item;
};

export const softDeleteProduct = async (productId) => {
  const item = await Product.findByIdAndUpdate(productId, {
    isDeleted: true,
    isActive: false,
    deletedAt: new Date()
  }, { new: true });

  if (!item) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }

  // Also soft delete variants
  await ProductVariant.updateMany(
    { productId: item._id },
    { isDeleted: true, isActive: false, deletedAt: new Date() }
  );

  clearRecommendationCache();

  return item;
};
