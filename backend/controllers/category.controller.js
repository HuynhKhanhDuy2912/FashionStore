import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { createCrudControllers } from "./base.controller.js";

const baseCrud = createCrudControllers(Category, {
  modelName: "Category",
  populate: [{ path: "parentId", select: "name imageUrl" }]
});

const normalizeParentId = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value === "") return null;
  if (value === "null") return null;
  return value;
};

const normalizeImageUrl = (value) => (value || "").trim();

const list = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 10000);

    const [items, total] = await Promise.all([
      Category.find({})
        .populate({ path: "parentId", select: "name imageUrl" })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Category.countDocuments({})
    ]);

    return res.status(200).json({
      success: true,
      message: "Category list fetched successfully",
      data: items,
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

const getCategoryDepth = async (categoryId) => {
  let depth = 0;
  let cursor = await Category.findById(categoryId).select("parentId");

  if (!cursor) return -1;

  while (cursor.parentId) {
    depth += 1;
    cursor = await Category.findById(cursor.parentId).select("parentId");
    if (!cursor) break;
  }

  return depth;
};

const isAncestorChainContains = async (startId, targetId) => {
  let cursor = await Category.findById(startId).select("parentId");

  while (cursor?.parentId) {
    const parentId = String(cursor.parentId);
    if (parentId === String(targetId)) return true;
    cursor = await Category.findById(parentId).select("parentId");
  }

  return false;
};

const create = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const parentId = normalizeParentId(req.body?.parentId);
    const imageUrl = normalizeImageUrl(req.body?.imageUrl);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    let nextDepth = 0;
    if (parentId) {
      const parentDepth = await getCategoryDepth(parentId);
      if (parentDepth < 0) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found"
        });
      }

      nextDepth = parentDepth + 1;
      if (nextDepth > 2) {
        return res.status(400).json({
          success: false,
          message: "Category supports maximum 3 levels only"
        });
      }
    }

    if (nextDepth > 0 && !imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Level 2/3 category must have image"
      });
    }

    const payload = {
      name,
      parentId: parentId || null,
      imageUrl: imageUrl
    };

    req.body = payload;
    return baseCrud.create(req, res);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const update = async (req, res) => {
  try {
    const current = await Category.findById(req.params.id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const nextName = (req.body?.name ?? current.name ?? "").trim();
    const requestedParentId = normalizeParentId(req.body?.parentId);
    const finalParentId = requestedParentId === undefined ? current.parentId : requestedParentId;

    if (!nextName) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    if (finalParentId && String(finalParentId) === String(current._id)) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be parent of itself"
      });
    }

    let nextDepth = 0;
    if (finalParentId) {
      const parentDepth = await getCategoryDepth(finalParentId);
      if (parentDepth < 0) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found"
        });
      }

      nextDepth = parentDepth + 1;
      if (nextDepth > 2) {
        return res.status(400).json({
          success: false,
          message: "Category supports maximum 3 levels only"
        });
      }

      const hasCycle = await isAncestorChainContains(finalParentId, current._id);
      if (hasCycle) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category (cycle detected)"
        });
      }
    }

    const nextImageUrl =
      req.body?.imageUrl !== undefined
        ? normalizeImageUrl(req.body?.imageUrl)
        : normalizeImageUrl(current.imageUrl);

    if (nextDepth > 0 && !nextImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Level 2/3 category must have image"
      });
    }

    req.body = {
      name: nextName,
      parentId: finalParentId || null,
      imageUrl: nextImageUrl
    };

    return baseCrud.update(req, res);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

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

export default { ...baseCrud, list, create, update, remove };
