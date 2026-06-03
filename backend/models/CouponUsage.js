import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true
    },

    discountAmount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { timestamps: true }
);

couponUsageSchema.index({ couponId: 1, userId: 1 });
couponUsageSchema.index({ orderId: 1 });

export default mongoose.model("CouponUsage", couponUsageSchema);
