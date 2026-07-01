import { createVirtualTryOn } from "../services/virtualTryOn.service.js";

export const generateVirtualTryOn = async (req, res) => {
  try {
    const result = await createVirtualTryOn({
      personImage: req.files?.personImage?.[0],
      garmentImage: req.files?.garmentImage?.[0],
      garmentImageUrl: req.body.garmentImageUrl,
      category: req.body.category,
      productId: req.body.productId,
      userId: req.user?._id,
    });

    return res.status(200).json({
      success: true,
      message: "Virtual try-on generated successfully",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  generateVirtualTryOn,
};