import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { deleteMediaFromCloudinaryIfUnused } from "../config/cloudinary.js";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      minlength: 6,
      select: false,
    },

    googleId: {
      type: String,
      trim: true,
    },

    firebaseUid: {
      type: String,
      trim: true,
    },

    authProviders: {
      type: [String],
      enum: ["email", "google", "phone", "firebase_phone"],
      default: ["email"],
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    avatar: {
      type: String,
      trim: true,
      default: "",
    },

    fullname: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    gender: {
      type: String,
      trim: true,
      enum: ["male", "female", ""],
    },

    favoriteStyles: {
      type: [String],
      default: [],
    },

    favoriteColors: {
      type: [String],
      default: [],
    },

    role: {
      type: String,
      trim: true,
      enum: ["user", "admin"],
      default: "user",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    height: {
      type: Number,
      min: 0,
      default: 0,
    },

    weight: {
      type: Number,
      min: 0,
      default: 0,
    },

    phone_number: {
      type: String,
      trim: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

userSchema.index({ username: 1 });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone_number: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ favoriteStyles: 1 });
userSchema.index({ favoriteColors: 1 });

userSchema.pre("save", async function savePassword(next) {
  if (!this.password || !this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.pre("save", async function cleanupOldAvatarOnSave(next) {
  if (this.isNew || !this.isModified("avatar")) {
    return next();
  }

  try {
    const current = await this.constructor
      .findById(this._id)
      .select("avatar")
      .lean();
    if (current?.avatar && current.avatar !== this.avatar) {
      this.$locals.removedMediaUrls = [current.avatar];
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.post("save", async function cleanupOldAvatarAfterSave(doc) {
  for (const mediaUrl of doc.$locals.removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

userSchema.methods.comparePassword = function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.pre("findOneAndUpdate", async function hashPasswordOnUpdate(next) {
  const update = this.getUpdate();

  if (!update || !update.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    update.password = await bcrypt.hash(update.password, salt);
    this.setUpdate(update);
    return next();
  } catch (error) {
    return next(error);
  }
});

const getUpdatedValue = (update = {}, field) => {
  if (Object.prototype.hasOwnProperty.call(update, field)) return update[field];
  if (Object.prototype.hasOwnProperty.call(update.$set || {}, field))
    return update.$set[field];
  if (Object.prototype.hasOwnProperty.call(update.$unset || {}, field))
    return "";
  return undefined;
};

userSchema.pre("findOneAndUpdate", async function cleanupOldAvatarOnUpdate() {
  const nextAvatar = getUpdatedValue(this.getUpdate() || {}, "avatar");

  if (nextAvatar !== undefined) {
    const current = await this.model
      .findOne(this.getQuery())
      .select("avatar")
      .lean();
    if (current?.avatar && current.avatar !== nextAvatar) {
      this._removedMediaUrls = [current.avatar];
    }
  }
});

userSchema.post("findOneAndUpdate", async function () {
  for (const mediaUrl of this._removedMediaUrls || []) {
    await deleteMediaFromCloudinaryIfUnused(mediaUrl);
  }
});

userSchema.post("findOneAndDelete", async function (docToUpdate) {
  if (docToUpdate?.avatar) {
    await deleteMediaFromCloudinaryIfUnused(docToUpdate.avatar);
  }
});

export default mongoose.model("User", userSchema);
