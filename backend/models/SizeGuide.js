import mongoose from "mongoose";

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

export default mongoose.model("SizeGuide", sizeGuideSchema);
