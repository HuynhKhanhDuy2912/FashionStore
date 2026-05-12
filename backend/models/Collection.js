import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên bộ sưu tập là bắt buộc"],
      trim: true,
      maxlength: 150
    },

    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true
    },

    description: {
      type: String,
      trim: true,
      default: ""
    },

    coverImage: {
      type: String,
      default: ""
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      }
    ],

    isActive: {
      type: Boolean,
      default: true
    },

    order: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Auto-generate slug from name before save
collectionSchema.pre("validate", function (next) {
  if (this.name && (!this.slug || this.isModified("name"))) {
    this.slug = this.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);
  }
  next();
});

collectionSchema.index({ slug: 1 });
collectionSchema.index({ isActive: 1, order: 1 });

export default mongoose.model("Collection", collectionSchema);
