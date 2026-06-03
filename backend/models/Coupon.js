import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 30
    },

    description: {
      type: String,
      trim: true,
      default: ""
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed_amount", "free_shipping"],
      required: true
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0
    },

    maxDiscountAmount: {
      type: Number,
      default: null
    },

    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    maxUsage: {
      type: Number,
      default: null
    },

    maxUsagePerUser: {
      type: Number,
      default: 1,
      min: 1
    },

    currentUsage: {
      type: Number,
      default: 0,
      min: 0
    },

    isFirstOrderOnly: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);


couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
couponSchema.index({ discountType: 1 });

export default mongoose.model("Coupon", couponSchema);
