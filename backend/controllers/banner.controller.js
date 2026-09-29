import Banner from "../models/Banner.js";
import { createCrudControllers } from "./base.controller.js";
import {
  getAdminBannersService,
  getActiveBannersService,
  createBannerService,
  updateBannerService,
  toggleBannerStatusService,
  updateBannerOrderService,
} from "../services/banner.service.js";

const baseBannerController = createCrudControllers(Banner, {
  modelName: "Banner",
  defaultSort: { order: 1, createdAt: -1 },
});

export const getAdminBanners = async (_req, res) => {
  try {
    const banners = await getAdminBannersService();

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
    const banners = await getActiveBannersService();

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
    const banner = await createBannerService(req.body);

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const banner = await updateBannerService(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: banner,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const toggleBannerStatus = async (req, res) => {
  try {
    const banner = await toggleBannerStatusService(req.params.bannerId);

    return res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? "activated" : "deactivated"} successfully`,
      data: banner,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateBannerOrder = async (req, res) => {
  try {
    const banner = await updateBannerOrderService(req.params.bannerId, req.body.order);

    return res.status(200).json({
      success: true,
      message: "Banner order updated successfully",
      data: banner,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
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
