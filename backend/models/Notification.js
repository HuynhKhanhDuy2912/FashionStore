import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["order", "review", "question"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductQuestion",
      },
      productName: String,
      orderNumber: String,
      customerName: String,
      reviewRating: Number,
      userName: String,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;