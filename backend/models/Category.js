import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },

  imageUrl: {
    type: String,
    trim: true,
    default: ""
  },

  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null
  }
}, { timestamps: true });

const getUpdatedValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field)) return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field)) return "";
  return undefined;
};

categorySchema.pre("findOneAndUpdate", async function() {
  const nextImageUrl = getUpdatedValue(this.getUpdate() || {}, "imageUrl");

  if (nextImageUrl !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select("imageUrl").lean();
    if (current?.imageUrl && current.imageUrl !== nextImageUrl) {
      this._removedMediaUrls = [current.imageUrl];
    }
  }

});

categorySchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

categorySchema.post("findOneAndDelete", async function(docToUpdate) {
  if (docToUpdate?.imageUrl) {
    await deleteMediaFromCloudinaryIfUnused(docToUpdate.imageUrl);
  }
});

export default mongoose.model("Category", categorySchema);
