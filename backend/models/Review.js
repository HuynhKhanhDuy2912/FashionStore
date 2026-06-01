import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
    index: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  comment: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ""
  },

  imageUrls: {
    type: [String],
    default: []
  },

  videoUrls: {
    type: [String],
    default: []
  },

  isHidden: {
    type: Boolean,
    default: false,
    index: true
  }

}, { timestamps: true });

reviewSchema.index({ userId: 1, productId: 1, orderId: 1 });
reviewSchema.index({ orderId: 1, productId: 1 });

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

reviewSchema.pre("findOneAndUpdate", async function() {
  const update = this.getUpdate() || {};
  const nextImageUrls = getUpdatedArrayValue(update, "imageUrls");
  const nextVideoUrls = getUpdatedArrayValue(update, "videoUrls");

  if (nextImageUrls !== undefined || nextVideoUrls !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select("imageUrls videoUrls").lean();
    this._removedMediaUrls = [
      ...(nextImageUrls !== undefined ? getRemovedMediaUrls(current?.imageUrls, nextImageUrls) : []),
      ...(nextVideoUrls !== undefined ? getRemovedMediaUrls(current?.videoUrls, nextVideoUrls) : []),
    ];
  }

});

reviewSchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

reviewSchema.post("findOneAndDelete", async function(docToUpdate) {
  const mediaUrls = [
    ...(docToUpdate?.imageUrls || []),
    ...(docToUpdate?.videoUrls || []),
  ];

  for (const mediaUrl of mediaUrls) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

export default mongoose.model("Review", reviewSchema);
