import mongoose from "mongoose";
import { deleteImageFromCloudinary } from "../config/cloudinary.js";

const productImageSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  },

  imageUrl: String,
  color: { type: String, trim: true, default: "" },
  isMain: { type: Boolean, default: false }
});

productImageSchema.pre('findOneAndDelete', async function(next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate && docToUpdate.imageUrl) {
      await deleteImageFromCloudinary(docToUpdate.imageUrl);
    }
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("ProductImage", productImageSchema);