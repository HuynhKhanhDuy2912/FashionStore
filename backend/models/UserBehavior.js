import mongoose from "mongoose";

const behaviorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },

    actionType: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "view_product",
        "search",
        "filter",
        "click",
        "add_to_cart",
        "remove_from_cart",
        "add_to_wishlist",
        "remove_from_wishlist",
        "purchase"
      ]
    },

    source: {
      type: String,
      trim: true,
      enum: [
        "home",
        "search",
        "category",
        "recommendation",
        "wishlist",
        "cart",
        "product_page",
        "buy_now",
        "other"
      ],
      default: "other"
    },

    duration: {
      type: Number,
      min: 0,
      default: 0
    },

    trackingSessionId: {
      type: String,
      trim: true
    },

    searchKeyword: {
      type: String,
      trim: true,
      default: ""
    },

    metadata: {
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        default: null
      },
      // [String] để khớp với Product.style / Product.occasion (vốn là mảng).
      // Tránh Mongoose cast mảng -> chuỗi "minimal,casual" (token rác).
      style: {
        type: [String],
        default: []
      },
      occasion: {
        type: [String],
        default: []
      },
      // Lưu kèm cho add_to_cart (trước đây bị strict mode loại bỏ âm thầm)
      variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
        default: null
      },
      quantity: {
        type: Number,
        min: 1,
        default: null
      }
    }
  },
  { timestamps: true }
);

behaviorSchema.index({ userId: 1, createdAt: -1 });
behaviorSchema.index({ userId: 1, actionType: 1, createdAt: -1 });
behaviorSchema.index({ productId: 1, actionType: 1 });
behaviorSchema.index(
  { userId: 1, trackingSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      trackingSessionId: { $exists: true, $type: "string" }
    }
  }
);

export default mongoose.model("UserBehavior", behaviorSchema);
