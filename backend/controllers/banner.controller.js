import Banner from "../models/Banner.js";
import Collection from "../models/Collection.js";
import { createCrudControllers } from "./base.controller.js";

const baseBannerController = createCrudControllers(Banner, {
  modelName: "Banner",
  defaultSort: { order: 1, createdAt: -1 },
});

export const getAdminBanners = async (_req, res) => {
  try {
    const banners = await Banner.find({})
      .populate("collectionId", "_id name slug")
      .sort({ order: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách banner thành công",
      data: banners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getActiveBanners = async (_req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .populate("collectionId", "_id name slug")
      .sort({ order: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách banner thành công",
      data: banners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createBanner = async (req, res) => {
  try {
    const imageUrl = (req.body?.imageUrl || "").trim();

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    const collectionId = req.body?.collectionId || null;
    if (collectionId) {
      const collectionExists = await Collection.exists({
        _id: collectionId,
        isActive: true,
      });
      if (!collectionExists) {
        return res.status(400).json({
          success: false,
          message: "Bộ sưu tập không hợp lệ hoặc đã bị ẩn",
        });
      }
    }

    req.body = {
      title: (req.body?.title || "").trim(),
      imageUrl,
      collectionId,
      isActive:
        req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true,
      order: Number(req.body?.order) || 0,
    };

    return baseBannerController.create(req, res);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const payload = {};

    if (req.body?.title !== undefined)
      payload.title = String(req.body.title).trim();
    if (req.body?.imageUrl !== undefined)
      payload.imageUrl = String(req.body.imageUrl).trim();
    if (req.body?.collectionId !== undefined) {
      const collectionId = req.body.collectionId || null;
      if (collectionId) {
        const collectionExists = await Collection.exists({
          _id: collectionId,
          isActive: true,
        });
        if (!collectionExists) {
          return res.status(400).json({
            success: false,
            message: "Bộ sưu tập không hợp lệ hoặc đã bị ẩn",
          });
        }
      }
      payload.collectionId = collectionId;
    }
    if (req.body?.isActive !== undefined)
      payload.isActive = Boolean(req.body.isActive);
    if (req.body?.order !== undefined)
      payload.order = Number(req.body.order) || 0;

    req.body = payload;
    return baseBannerController.update(req, res);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const toggleBannerStatus = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    return res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? "activated" : "deactivated"} successfully`,
      data: banner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateBannerOrder = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { order } = req.body;

    if (typeof order !== "number") {
      return res.status(400).json({
        success: false,
        message: "Order must be a number",
      });
    }

    const banner = await Banner.findByIdAndUpdate(
      bannerId,
      { order },
      { new: true },
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Banner order updated successfully",
      data: banner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  ...baseBannerController,
  create: createBanner,
  update: updateBanner,
  getAdminBanners,
  getActiveBanners,
  toggleBannerStatus,
  updateBannerOrder,
};
