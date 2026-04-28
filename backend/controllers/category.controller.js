import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { createCrudControllers } from "./base.controller.js";

const baseCrud = createCrudControllers(Category, {
  modelName: "Category",
  populate: [{ path: "parentId", select: "name imageUrl" }]
});

const remove = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate("parentId", "name");

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const childCount = await Category.countDocuments({ parentId: category._id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}" because it still has ${childCount} child categories`
      });
    }

    const productCount = await Product.countDocuments({ categoryId: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}" because it is used by ${productCount} products`
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Category "${category.name}" deleted`,
      data: category
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default { ...baseCrud, remove };
