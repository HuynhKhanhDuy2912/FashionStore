import Wishlist from "../models/Wishlist.js";
import { enrichProducts } from "./enrichProduct.service.js";

export const addWishlistItemService = async (userId, productData) => {
  const existingItem = await Wishlist.findOne({
    userId,
    productId: productData.productId
  });

  if (existingItem) {
    return { item: existingItem, alreadyExists: true };
  }

  const item = await Wishlist.create({
    userId,
    productId: productData.productId,
    addedFrom: productData.addedFrom,
    note: productData.note
  });

  const populatedItem = await Wishlist.findById(item._id)
    .populate("userId", "username email")
    .populate("productId", "name price discount");

  return { item: populatedItem, alreadyExists: false };
};

export const removeWishlistItemByProductService = async (userId, productId) => {
  const deletedItem = await Wishlist.findOneAndDelete({
    userId,
    productId
  });

  if (!deletedItem) {
    throw Object.assign(new Error("Wishlist item not found"), { statusCode: 404 });
  }

  return deletedItem;
};

export const getMyWishlistSummaryService = async (userId) => {
  let items = await Wishlist.find({ userId })
    .sort({ createdAt: -1 })
    .populate("productId", "name slug price discount style averageRating gender occasion images")
    .lean();

  const products = items.map(item => item.productId).filter(Boolean);
  const enrichedProducts = await enrichProducts(products);

  items = items.map(item => {
    if (item.productId) {
      const enriched = enrichedProducts.find(p => p._id.toString() === item.productId._id.toString());
      if (enriched) {
        item.productId = enriched;
      }
    }
    return item;
  });

  return {
    totalItems: items.length,
    items
  };
};
