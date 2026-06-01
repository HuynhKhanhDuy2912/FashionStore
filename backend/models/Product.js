import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";
import ProductVariant from "./ProductVariant.js";
import ProductImage from "./PrductImage.js";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },

    description: {
      type: String,
      trim: true,
      default: ""
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    costPrice: {
      type: Number,
      min: 0,
      default: 0
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    gender: {
      type: String,
      trim: true,
      enum: ["male", "female"],
      default: ""
    },

    material: {
      type: String,
      trim: true,
      default: ""
    },

    style: {
      type: [String],
      enum: [
        "minimal",
        "streetwear",
        "casual",
        "elegant",
        "sporty",
        "vintage",
        "smart_casual"
      ],
      default: ["casual"]
    },

    season: {
      type: [String],
      enum: ["spring", "summer", "autumn", "winter", "all_season"],
      default: ["all_season"]
    },

    occasion: {
      type: [String],
      enum: ["casual", "work", "party", "date", "travel", "sport", "formal", "street"],
      default: ["casual"]
    },

    images: {
      type: [String],
      default: []
    },

    videos: {
      type: [String],
      default: []
    },

    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },

    totalReviews: {
      type: Number,
      min: 0,
      default: 0
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

productSchema.index({ categoryId: 1, gender: 1, isActive: 1 });
productSchema.index({ style: 1 });
productSchema.index({ season: 1 });
productSchema.index({ occasion: 1 });
productSchema.index({ slug: 1 });

const createSlug = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

productSchema.pre("validate", function(next) {
  if (this.name && (!this.slug || this.isModified("name"))) {
    this.slug = createSlug(this.name);
  }
  next();
});

const getUpdatedArrayValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field)) return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field)) return [];
  return undefined;
};

const getRemovedMediaUrls = (currentUrls = [], nextUrls = []) => {
  const nextSet = new Set((nextUrls || []).filter(Boolean));
  return [...new Set((currentUrls || []).filter(Boolean))].filter(
    (url) => !nextSet.has(url),
  );
};

productSchema.pre("findOneAndUpdate", async function() {
  const update = this.getUpdate() || {};
  const name = update.name || update.$set?.name;

  const nextUpdate =
    name && !update.slug && !update.$set?.slug
      ? {
          ...update,
          $set: {
            ...(update.$set || {}),
            slug: createSlug(name)
          }
        }
      : update;

  this.setUpdate(nextUpdate);

  const nextImages = getUpdatedArrayValue(nextUpdate, "images");
  const nextVideos = getUpdatedArrayValue(nextUpdate, "videos");

  if (nextImages !== undefined || nextVideos !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select("images videos").lean();
    this._removedMediaUrls = [
      ...(nextImages !== undefined ? getRemovedMediaUrls(current?.images, nextImages) : []),
      ...(nextVideos !== undefined ? getRemovedMediaUrls(current?.videos, nextVideos) : []),
    ];
  }

});

productSchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

productSchema.post('findOneAndDelete', async function(docToUpdate) {
  if (!docToUpdate) return;

  try {
    for (const imgUrl of docToUpdate.images || []) {
      await deleteMediaFromCloudinaryIfUnused(imgUrl);
    }

    for (const videoUrl of docToUpdate.videos || []) {
      await deleteMediaFromCloudinaryIfUnused(videoUrl);
    }

    const variants = await ProductVariant.find({ productId: docToUpdate._id });
    for (const variant of variants) {
      await ProductVariant.findByIdAndDelete(variant._id);
    }

    const images = await ProductImage.find({ productId: docToUpdate._id });
    for (const image of images) {
      await ProductImage.findByIdAndDelete(image._id);
    }
  } catch (error) {
    console.error("Error cleaning product media:", error);
  }
});

export default mongoose.model("Product", productSchema);
