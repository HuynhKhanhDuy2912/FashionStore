import Product from "../models/Product.js";
import { createCrudControllers } from "./base.controller.js";
import {
  listProducts,
  getProductById,
  updateProduct,
  softDeleteProduct,
} from "../services/product.service.js";

const baseProductController = createCrudControllers(Product, {
  modelName: "Product",
  populate: [{ path: "categoryId", select: "name" }]
});

const list = async (req, res) => {
  try {
    const result = await listProducts(req.query, req.user);

    return res.status(200).json({
      success: true,
      message: "Product list fetched successfully",
      data: result.data,
      pagination: result.pagination
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
    const product = await getProductById(req.params.id, req.user);

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

const update = async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message
    });
  }
};

const remove = async (req, res) => {
  try {
    const product = await softDeleteProduct(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Product soft deleted successfully",
      data: product
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
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
