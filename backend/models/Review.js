import mongoose from "mongoose";

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
  }

}, { timestamps: true });

reviewSchema.index({ userId: 1, productId: 1 });

export default mongoose.model("Review", reviewSchema);
