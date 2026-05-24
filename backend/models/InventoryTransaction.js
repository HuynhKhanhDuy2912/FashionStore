import mongoose from "mongoose";

const inventoryTransactionSchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ["import", "export", "adjustment", "return"],
      required: true,
      index: true
    },

    quantity: {
      type: Number,
      required: true
    },

    previousStock: {
      type: Number,
      required: true,
      min: 0
    },

    newStock: {
      type: Number,
      required: true,
      min: 0
    },

    costPrice: {
      type: Number,
      min: 0,
      default: null
    },

    reason: {
      type: String,
      required: true,
      trim: true
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    note: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { timestamps: true }
);

inventoryTransactionSchema.index({ variantId: 1, createdAt: -1 });
inventoryTransactionSchema.index({ productId: 1, createdAt: -1 });
inventoryTransactionSchema.index({ type: 1, createdAt: -1 });
inventoryTransactionSchema.index({ orderId: 1 }, { sparse: true });

export default mongoose.model("InventoryTransaction", inventoryTransactionSchema);
