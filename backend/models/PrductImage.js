import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const productImageSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  },

  imageUrl: String,
  color: { type: String, trim: true, default: "" },
  isMain: { type: Boolean, default: false }
});

const getUpdatedValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field)) return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field)) return "";
  return undefined;
};

productImageSchema.pre("findOneAndUpdate", async function() {
  const nextImageUrl = getUpdatedValue(this.getUpdate() || {}, "imageUrl");

  if (nextImageUrl !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select("imageUrl").lean();
    if (current?.imageUrl && current.imageUrl !== nextImageUrl) {
      this._removedMediaUrls = [current.imageUrl];
    }
  }

});

productImageSchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

productImageSchema.post('findOneAndDelete', async function(docToUpdate) {
  if (docToUpdate?.imageUrl) {
    await deleteMediaFromCloudinaryIfUnused(docToUpdate.imageUrl);
  }
});

export default mongoose.model("ProductImage", productImageSchema);
