import mongoose from "mongoose";

const productQuestionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    answer: {
      type: String,
      trim: true,
      default: "",
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    isAnswered: {
      type: Boolean,
      default: false,
      index: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

productQuestionSchema.index({ productId: 1, isAnswered: 1, isHidden: 1, createdAt: -1 });

const ProductQuestion = mongoose.model("ProductQuestion", productQuestionSchema);
export default ProductQuestion;
