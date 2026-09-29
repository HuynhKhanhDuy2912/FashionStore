import Category from "../models/Category.js";
import Product from "../models/Product.js";

const normalizeParentId = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value === "") return null;
  if (value === "null") return null;
  return value;
};

const normalizeImageUrl = (value) => (value || "").trim();

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

export const listCategoriesService = async (queryParams) => {
  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Math.max(Number(queryParams.limit) || 1000, 1), 10000);

  const showHidden = queryParams.showHidden === "true";
  const filter = {};
  if (!showHidden) filter.isHidden = { $ne: true };

  const [items, total] = await Promise.all([
    Category.find(filter)
      .populate({ path: "parentId", select: "name imageUrl" })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(filter)
  ]);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const createCategoryService = async (categoryData) => {
  const name = (categoryData?.name || "").trim();
  const parentId = normalizeParentId(categoryData?.parentId);
  const imageUrl = normalizeImageUrl(categoryData?.imageUrl);

  if (!name) {
    throw Object.assign(new Error("Category name is required"), { statusCode: 400 });
  }

  let nextDepth = 0;
  if (parentId) {
    const parentDepth = await getCategoryDepth(parentId);
    if (parentDepth < 0) {
      throw Object.assign(new Error("Parent category not found"), { statusCode: 400 });
    }

    nextDepth = parentDepth + 1;
    if (nextDepth > 2) {
      throw Object.assign(new Error("Category supports maximum 3 levels only"), { statusCode: 400 });
    }
  }

  if (nextDepth > 0 && !imageUrl) {
    throw Object.assign(new Error("Level 2/3 category must have image"), { statusCode: 400 });
  }

  const isHidden = categoryData?.isHidden || false;

  const category = await Category.create({
    name,
    parentId: parentId || null,
    imageUrl: imageUrl,
    isHidden
  });

  const populated = await Category.findById(category._id)
    .populate({ path: "parentId", select: "name imageUrl" });

  return populated;
};

export const updateCategoryService = async (categoryId, categoryData) => {
  const current = await Category.findById(categoryId);

  if (!current) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }

  const nextName = (categoryData?.name ?? current.name ?? "").trim();
  const requestedParentId = normalizeParentId(categoryData?.parentId);
  const finalParentId = requestedParentId === undefined ? current.parentId : requestedParentId;

  if (!nextName) {
    throw Object.assign(new Error("Category name is required"), { statusCode: 400 });
  }

  if (finalParentId && String(finalParentId) === String(current._id)) {
    throw Object.assign(new Error("Category cannot be parent of itself"), { statusCode: 400 });
  }

  let nextDepth = 0;
  if (finalParentId) {
    const parentDepth = await getCategoryDepth(finalParentId);
    if (parentDepth < 0) {
      throw Object.assign(new Error("Parent category not found"), { statusCode: 400 });
    }

    nextDepth = parentDepth + 1;
    if (nextDepth > 2) {
      throw Object.assign(new Error("Category supports maximum 3 levels only"), { statusCode: 400 });
    }

    const hasCycle = await isAncestorChainContains(finalParentId, current._id);
    if (hasCycle) {
      throw Object.assign(new Error("Invalid parent category (cycle detected)"), { statusCode: 400 });
    }
  }

  const nextImageUrl =
    categoryData?.imageUrl !== undefined
      ? normalizeImageUrl(categoryData?.imageUrl)
      : normalizeImageUrl(current.imageUrl);

  if (nextDepth > 0 && !nextImageUrl) {
    throw Object.assign(new Error("Level 2/3 category must have image"), { statusCode: 400 });
  }

  const isHidden = categoryData?.isHidden !== undefined ? categoryData.isHidden : (current.isHidden || false);

  const updated = await Category.findByIdAndUpdate(
    categoryId,
    {
      name: nextName,
      parentId: finalParentId || null,
      imageUrl: nextImageUrl,
      isHidden
    },
    { new: true, runValidators: true }
  ).populate({ path: "parentId", select: "name imageUrl" });

  return updated;
};

export const deleteCategoryService = async (categoryId) => {
  const category = await Category.findById(categoryId).populate("parentId", "name");

  if (!category) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }

  const childCount = await Category.countDocuments({ parentId: category._id });
  if (childCount > 0) {
    throw Object.assign(
      new Error(`Cannot delete category "${category.name}" because it still has ${childCount} child categories`),
      { statusCode: 400 }
    );
  }

  const productCount = await Product.countDocuments({ categoryId: category._id });
  if (productCount > 0) {
    throw Object.assign(
      new Error(`Cannot delete category "${category.name}" because it is used by ${productCount} products`),
      { statusCode: 400 }
    );
  }

  await Category.findByIdAndDelete(categoryId);

  return category;
};
