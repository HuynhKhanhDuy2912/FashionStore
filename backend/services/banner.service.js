import Banner from "../models/Banner.js";
import Collection from "../models/Collection.js";

export const getAdminBannersService = async () => {
  const banners = await Banner.find({})
    .populate("collectionId", "_id name slug")
    .sort({ order: 1, createdAt: -1 });

  return banners;
};

export const getActiveBannersService = async () => {
  const banners = await Banner.find({ isActive: true })
    .populate("collectionId", "_id name slug")
    .sort({ order: 1, createdAt: -1 });

  return banners;
};

export const createBannerService = async (bannerData) => {
  const imageUrl = (bannerData?.imageUrl || "").trim();

  if (!imageUrl) {
    throw Object.assign(new Error("Banner image is required"), {
      statusCode: 400,
    });
  }

  const collectionId = bannerData?.collectionId || null;
  if (collectionId) {
    const collectionExists = await Collection.exists({
      _id: collectionId,
      isActive: true,
    });
    if (!collectionExists) {
      throw Object.assign(
        new Error("Bộ sưu tập không hợp lệ hoặc đã bị ẩn"),
        { statusCode: 400 },
      );
    }
  }

  const banner = await Banner.create({
    title: (bannerData?.title || "").trim(),
    imageUrl,
    collectionId,
    isActive:
      bannerData?.isActive !== undefined ? Boolean(bannerData.isActive) : true,
    order: Number(bannerData?.order) || 0,
  });

  return banner;
};

export const updateBannerService = async (bannerId, bannerData) => {
  const payload = {};

  if (bannerData?.title !== undefined)
    payload.title = String(bannerData.title).trim();
  if (bannerData?.imageUrl !== undefined)
    payload.imageUrl = String(bannerData.imageUrl).trim();
  if (bannerData?.collectionId !== undefined) {
    const collectionId = bannerData.collectionId || null;
    if (collectionId) {
      const collectionExists = await Collection.exists({
        _id: collectionId,
        isActive: true,
      });
      if (!collectionExists) {
        throw Object.assign(
          new Error("Bộ sưu tập không hợp lệ hoặc đã bị ẩn"),
          { statusCode: 400 },
        );
      }
    }
    payload.collectionId = collectionId;
  }
  if (bannerData?.isActive !== undefined)
    payload.isActive = Boolean(bannerData.isActive);
  if (bannerData?.order !== undefined)
    payload.order = Number(bannerData.order) || 0;

  const banner = await Banner.findByIdAndUpdate(bannerId, payload, {
    new: true,
    runValidators: true,
  });

  if (!banner) {
    throw Object.assign(new Error("Banner not found"), { statusCode: 404 });
  }

  return banner;
};

export const toggleBannerStatusService = async (bannerId) => {
  const banner = await Banner.findById(bannerId);

  if (!banner) {
    throw Object.assign(new Error("Banner not found"), { statusCode: 404 });
  }

  banner.isActive = !banner.isActive;
  await banner.save();

  return banner;
};

export const updateBannerOrderService = async (bannerId, order) => {
  if (typeof order !== "number") {
    throw Object.assign(new Error("Order must be a number"), {
      statusCode: 400,
    });
  }

  const banner = await Banner.findByIdAndUpdate(
    bannerId,
    { order },
    { new: true },
  );

  if (!banner) {
    throw Object.assign(new Error("Banner not found"), { statusCode: 404 });
  }

  return banner;
};
