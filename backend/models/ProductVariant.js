import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const variantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    size: {
      type: String,
      required: true,
      trim: true
    },

    color: {
      type: String,
      required: true,
      trim: true
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },

    stock: {
      type: Number,
      min: 0,
      default: 0
    },

    priceAdjustment: {
      type: Number,
      default: 0
    },

    costPrice: {
      type: Number,
      min: 0,
      default: 0,
      required: true
    },

    discount: {
      type: Number,
      default: null,
      min: 0,
      max: 100
    },

    image: {
      type: String,
      trim: true,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

variantSchema.index({ sku: 1 }, { unique: true });
variantSchema.index({ productId: 1, color: 1, size: 1 }, { unique: true });
variantSchema.index({ productId: 1, isActive: 1 });

const getUpdatedValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field)) return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field)) return "";
  return undefined;
};

variantSchema.pre("findOneAndUpdate", async function() {
  const nextImage = getUpdatedValue(this.getUpdate() || {}, "image");

  if (nextImage !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select("image").lean();
    if (current?.image && current.image !== nextImage) {
      this._removedMediaUrls = [current.image];
    }
  }

});

variantSchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

variantSchema.post('findOneAndDelete', async function(docToUpdate) {
  if (docToUpdate?.image) {
    await deleteMediaFromCloudinaryIfUnused(docToUpdate.image);
  }
});

export default mongoose.model("ProductVariant", variantSchema);
