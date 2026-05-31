import mongoose from "mongoose";

const contactRequestSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    orderCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
      default: "",
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["new", "resolved"],
      default: "new",
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    replies: [
      {
        subject: {
          type: String,
          trim: true,
          maxlength: 200,
          default: "",
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 2000,
        },
        repliedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        repliedByName: {
          type: String,
          trim: true,
          default: "",
        },
        emailSent: {
          type: Boolean,
          default: false,
        },
        emailError: {
          type: String,
          trim: true,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    source: {
      type: String,
      default: "contact_page",
    },
  },
  {
    timestamps: true,
  }
);

contactRequestSchema.index({ createdAt: -1 });
contactRequestSchema.index({ email: 1, createdAt: -1 });
contactRequestSchema.index({ isRead: 1, createdAt: -1 });

const ContactRequest = mongoose.model("ContactRequest", contactRequestSchema);
export default ContactRequest;
