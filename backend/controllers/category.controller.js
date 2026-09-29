import Category from "../models/Category.js";
import { createCrudControllers } from "./base.controller.js";
import {
  listCategoriesService,
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
} from "../services/category.service.js";

const baseCrud = createCrudControllers(Category, {
  modelName: "Category",
  populate: [{ path: "parentId", select: "name imageUrl" }]
});

const list = async (req, res) => {
  try {
    const result = await listCategoriesService(req.query);

    return res.status(200).json({
      success: true,
      message: "Category list fetched successfully",
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

const create = async (req, res) => {
  try {
    const category = await createCategoryService(req.body);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message
    });
  }
};

const update = async (req, res) => {
  try {
    const category = await updateCategoryService(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category
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
    const category = await deleteCategoryService(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Category "${category.name}" deleted`,
      data: category
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

export default { ...baseCrud, list, create, update, remove };
