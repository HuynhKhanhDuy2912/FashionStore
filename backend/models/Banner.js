import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: ""
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      default: null
    },
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

const getUpdatedValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field)) return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field)) return "";
  return undefined;
};

bannerSchema.pre("findOneAndUpdate", async function() {
  const nextImageUrl = getUpdatedValue(this.getUpdate() || {}, "imageUrl");

  if (nextImageUrl !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select("imageUrl").lean();
    if (current?.imageUrl && current.imageUrl !== nextImageUrl) {
      this._removedMediaUrls = [current.imageUrl];
    }
  }

});

bannerSchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

bannerSchema.post("findOneAndDelete", async function(docToUpdate) {
  if (docToUpdate?.imageUrl) {
    await deleteMediaFromCloudinaryIfUnused(docToUpdate.imageUrl);
  }
});

export default mongoose.model("Banner", bannerSchema);
