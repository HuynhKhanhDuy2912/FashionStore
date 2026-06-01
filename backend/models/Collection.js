import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const collectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên bộ sưu tập là bắt buộc"],
      trim: true,
      maxlength: 150
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true
    },

    description: {
      type: String,
      trim: true,
      default: ""
    },

    coverImage: {
      type: String,
      default: ""
    },

    bannerImage: {
      type: String,
      default: ""
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      }
    ],

    isActive: {
      type: Boolean,
      default: true
    },

    order: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Auto-generate slug from name before save
collectionSchema.pre("validate", function (next) {
  if (this.name && (!this.slug || this.isModified("name"))) {
    this.slug = this.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);
  }
  next();
});

collectionSchema.index({ slug: 1 }, { unique: true });
collectionSchema.index({ isActive: 1, order: 1 });

const getUpdatedValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field)) return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field)) return "";
  return undefined;
};

collectionSchema.pre("findOneAndUpdate", async function() {
  const update = this.getUpdate() || {};
  const fields = ["coverImage", "bannerImage"];
  const current = await this.model.findOne(this.getQuery()).select(fields.join(" ")).lean();
  const removedMediaUrls = [];

  fields.forEach((field) => {
    const nextValue = getUpdatedValue(update, field);
    if (nextValue !== undefined && current?.[field] && current[field] !== nextValue) {
      removedMediaUrls.push(current[field]);
    }
  });

  this._removedMediaUrls = removedMediaUrls;
});

collectionSchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

collectionSchema.post("findOneAndDelete", async function(docToUpdate) {
  for (const mediaUrl of [docToUpdate?.coverImage, docToUpdate?.bannerImage].filter(Boolean)) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

export default mongoose.model("Collection", collectionSchema);
