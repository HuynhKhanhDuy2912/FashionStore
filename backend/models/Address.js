import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },

    province: {
      type: String,
      required: true,
      trim: true
    },

    district: {
      type: String,
      required: true,
      trim: true
    },

    ward: {
      type: String,
      required: true,
      trim: true
    },

    provinceId: {
      type: Number,
      default: null
    },

    districtId: {
      type: Number,
      default: null
    },

    wardCode: {
      type: String,
      default: null
    },

    street: {
      type: String,
      required: true,
      trim: true
    },

    addressDetail: {
      type: String,
      trim: true,
      default: ""
    },

    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

addressSchema.index({ userId: 1, isDefault: -1 });

addressSchema.pre("save", async function(next) {
  if (this.isDefault) {
    await mongoose.model("Address").updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

export default mongoose.model("Address", addressSchema);
