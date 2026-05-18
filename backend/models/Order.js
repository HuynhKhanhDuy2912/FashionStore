import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  totalPrice: { type: Number, min: 0, default: 0 },
  subTotal: { type: Number, min: 0, default: 0 },
  shippingFee: { type: Number, min: 0, default: 0 },
  discount: { type: Number, min: 0, default: 0 },

  status: {
    type: String,
    enum: ["pending", "confirmed", "shipping", "completed", "cancelled"],
    default: "pending"
  },

  paymentMethod: {
    type: String,
    enum: ["cod", "vnpay", "momo", "paypal"],
    default: "cod"
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  },

  shippingAddress: { type: String, trim: true, default: "" },
  receiverName: { type: String, trim: true, default: "" },
  receiverPhone: { type: String, trim: true, default: "" },
  note: { type: String, trim: true, default: "" },

  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, trim: true, default: "" }

}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
