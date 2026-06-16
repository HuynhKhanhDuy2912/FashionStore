import mongoose from "mongoose";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import OrderItem from "../models/OrderItem.js";
import { createCrudControllers } from "./base.controller.js";
import { clearRecommendationCache } from "../services/hybridRecommendation.service.js";
import { attachGalleryImagesToProducts } from "../services/productImage.service.js";

const productPopulate = [{ path: "categoryId", select: "name" }];

const baseProductController = createCrudControllers(Product, {
  modelName: "Product",
  populate: productPopulate
});

const createSlug = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const extractObjectId = (value = "") => {
  const directValue = String(value);
  if (/^[a-f\d]{24}$/i.test(directValue) && mongoose.Types.ObjectId.isValid(directValue)) return directValue;
  const match = String(value).match(/[a-f\d]{24}$/i);
  return match && mongoose.Types.ObjectId.isValid(match[0]) ? match[0] : null;
};

const applyPopulate = (query) => {
  productPopulate.forEach((item) => query.populate(item));
  return query;
};

const buildFilters = (query = {}) => {
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

const addComputedFields = async (products) => {
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

const list = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 10000);
    const sort = req.query.sort || { createdAt: -1 };
    const filters = buildFilters(req.query);

    if (!req.user || req.user.role !== "admin") {
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

    return res.status(200).json({
      success: true,
      message: "Product list fetched successfully",
      data: await addComputedFields(items),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getById = async (req, res) => {
  try {
    const identifier = req.params.id;
    const objectId = extractObjectId(identifier);
    const filters = objectId
      ? { _id: objectId }
      : { slug: createSlug(identifier) };

    if (!req.user || req.user.role !== "admin") {
      filters.isActive = true;
    }

    const query = Product.findOne(filters);

    applyPopulate(query);
    const item = await query;

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: await addComputedFields(item)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const update = async (req, res) => {
  try {
    const item = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Clear cache whenever a product is updated (especially isActive status)
    clearRecommendationCache();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: item
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const remove = async (req, res) => {
  try {
    const item = await Product.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      isActive: false,
      deletedAt: new Date()
    }, { new: true });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Also soft delete variants
    await ProductVariant.updateMany(
      { productId: item._id },
      { isDeleted: true, isActive: false, deletedAt: new Date() }
    );

    clearRecommendationCache();

    return res.status(200).json({
      success: true,
      message: "Product soft deleted successfully",
      data: item
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...baseProductController,
  list,
  getById,
  update,
  remove
};
