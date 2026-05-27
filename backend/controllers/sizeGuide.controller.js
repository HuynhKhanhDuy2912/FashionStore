import { createCrudControllers } from "./base.controller.js";
import SizeGuide from "../models/SizeGuide.js";

const crud = createCrudControllers(SizeGuide, {
  modelName: "SizeGuide",
  populate: [{ path: "categoryId", select: "name" }],
});

const getByCategoryId = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const sizeGuide = await SizeGuide.findOne({
      categoryId,
      isActive: true,
    }).populate("categoryId", "name");

    if (!sizeGuide) {
      return res.status(404).json({
        success: false,
        message: "Size guide not found for this category",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Size guide fetched successfully",
      data: sizeGuide,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  ...crud,
  getByCategoryId,
};
