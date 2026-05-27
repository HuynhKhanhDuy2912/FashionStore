import Wishlist from "../models/Wishlist.js";
import { createCrudControllers } from "./base.controller.js";
import { enrichProducts } from "./recommendation.controller.js";

const baseWishlistController = createCrudControllers(Wishlist, {
  modelName: "Wishlist",
  populate: [
    { path: "userId", select: "username email" },
    { path: "productId", select: "name price discount" }
  ]
});

export const addWishlistItem = async (req, res) => {
  try {
    const existingItem = await Wishlist.findOne({
      userId: req.user._id,
      productId: req.body.productId
    });

    if (existingItem) {
      return res.status(200).json({
        success: true,
        message: "Product is already in wishlist",
        data: existingItem
      });
    }

    const item = await Wishlist.create({
      userId: req.user._id,
      productId: req.body.productId,
      addedFrom: req.body.addedFrom,
      note: req.body.note
    });

    const populatedItem = await Wishlist.findById(item._id)
      .populate("userId", "username email")
      .populate("productId", "name price discount");

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist",
      data: populatedItem
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const removeWishlistItemByProduct = async (req, res) => {
  try {
    const deletedItem = await Wishlist.findOneAndDelete({
      userId: req.user._id,
      productId: req.params.productId
    });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      data: deletedItem
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMyWishlistSummary = async (req, res) => {
  try {
    let items = await Wishlist.find({ userId: req.user._id })
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

    return res.status(200).json({
      success: true,
      message: "Wishlist fetched successfully",
      data: {
        totalItems: items.length,
        items
      }
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
