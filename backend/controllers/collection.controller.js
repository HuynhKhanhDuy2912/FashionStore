import Collection from "../models/Collection.js";
import { createCrudControllers } from "./base.controller.js";
import {
  getCollectionByIdService,
  getCollectionBySlugService,
} from "../services/collection.service.js";

const crud = createCrudControllers(Collection, {
  modelName: "Collection",
  populate: [
    {
      path: "products",
      select: "name slug price discount images isActive"
    }
  ],
  defaultSort: { order: 1, createdAt: -1 }
});

const getById = async (req, res) => {
  try {
    const collection = await getCollectionByIdService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Collection fetched successfully",
      data: collection
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

// Custom: get collection by slug (public)
const getBySlug = async (req, res) => {
  try {
    const collection = await getCollectionBySlugService(req.params.slug);

    return res.status(200).json({
      success: true,
      data: collection
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...crud,
  getById,
  getBySlug
};
