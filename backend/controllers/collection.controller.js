import Collection from "../models/Collection.js";
import { createCrudControllers } from "./base.controller.js";

const crud = createCrudControllers(Collection, {
  modelName: "Collection",
  populate: [
    {
      path: "products",
      select: "name price discount images isActive"
    }
  ],
  defaultSort: { order: 1, createdAt: -1 }
});

// Custom: get collection by slug (public)
const getBySlug = async (req, res) => {
  try {
    const collection = await Collection.findOne({ slug: req.params.slug })
      .populate({
        path: "products",
        select: "name price discount images isActive",
        match: { isActive: true }
      });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bộ sưu tập"
      });
    }

    return res.status(200).json({
      success: true,
      data: collection
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...crud,
  getBySlug
};
