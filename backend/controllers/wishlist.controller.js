import Wishlist from "../models/Wishlist.js";
import { createCrudControllers } from "./base.controller.js";
import {
  addWishlistItemService,
  removeWishlistItemByProductService,
  getMyWishlistSummaryService,
} from "../services/wishlist.service.js";

const baseWishlistController = createCrudControllers(Wishlist, {
  modelName: "Wishlist",
  populate: [
    { path: "userId", select: "username email" },
    { path: "productId", select: "name price discount" }
  ]
});

export const addWishlistItem = async (req, res) => {
  try {
    const { item, alreadyExists } = await addWishlistItemService(req.user._id, req.body);

    return res.status(alreadyExists ? 200 : 201).json({
      success: true,
      message: alreadyExists ? "Product is already in wishlist" : "Product added to wishlist",
      data: item
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message
    });
  }
};

export const removeWishlistItemByProduct = async (req, res) => {
  try {
    const deletedItem = await removeWishlistItemByProductService(req.user._id, req.params.productId);

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      data: deletedItem
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMyWishlistSummary = async (req, res) => {
  try {
    const result = await getMyWishlistSummaryService(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Wishlist fetched successfully",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...baseWishlistController,
  addWishlistItem,
  removeWishlistItemByProduct,
  getMyWishlistSummary
};
