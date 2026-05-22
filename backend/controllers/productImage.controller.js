import ProductImage from "../models/PrductImage.js";
import { createCrudControllers } from "./base.controller.js";

const base = createCrudControllers(ProductImage, {
  modelName: "ProductImage",
  populate: [{ path: "productId", select: "name" }]
});

// Xóa khỏi DB mà không xóa trên Cloudinary
// Dùng khi dedup: URL ảnh vẫn còn được dùng bởi bản ghi khác nên không được xóa trên Cloudinary
const removeDbOnly = async (req, res) => {
  try {
    // Sử dụng deleteOne thay vì findByIdAndDelete
    // ⇒ không trigger pre('findOneAndDelete') nên không xóa Cloudinary
    const result = await ProductImage.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "ProductImage not found" });
    }
    return res.status(200).json({ success: true, message: "Deleted from DB only (Cloudinary kept)" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export default { ...base, removeDbOnly };
