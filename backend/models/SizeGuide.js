import mongoose from "mongoose";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const measurementLabelSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const sizeRowSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true },
    values: { type: [String], default: [] },
  },
  { _id: false }
);

const sizeGuideSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      unique: true,
    },

    title: {
      type: String,
      trim: true,
      default: "",
    },

    measurementImage: {
      type: String,
      trim: true,
      default: "",
    },

    measurementLabels: {
      type: [measurementLabelSchema],
      default: [],
    },

    headers: {
      type: [String],
      default: [],
    },

    unit: {
      type: String,
      trim: true,
      default: "cm",
    },

    rows: {
      type: [sizeRowSchema],
      default: [],
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const getUpdatedValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field)) return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field)) return "";
  return undefined;
};

sizeGuideSchema.pre("findOneAndUpdate", async function() {
  const nextMeasurementImage = getUpdatedValue(this.getUpdate() || {}, "measurementImage");

  if (nextMeasurementImage !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select("measurementImage").lean();
    if (current?.measurementImage && current.measurementImage !== nextMeasurementImage) {
      this._removedMediaUrls = [current.measurementImage];
    }
  }

});

sizeGuideSchema.post("findOneAndUpdate", async function() {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

sizeGuideSchema.post("findOneAndDelete", async function(docToUpdate) {
  if (docToUpdate?.measurementImage) {
    await deleteMediaFromCloudinaryIfUnused(docToUpdate.measurementImage);
  }
});

export default mongoose.model("SizeGuide", sizeGuideSchema);
