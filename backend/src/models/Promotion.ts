import mongoose, { Schema, Document } from "mongoose";

export type PromotionStatus = "Pending" | "Approved" | "Rejected";

export interface IPromotion extends Document {
  seller: mongoose.Types.ObjectId;
  title: string;
  image: string;
  link?: string;
  order: number;
  isActive: boolean;
  status: PromotionStatus;
  rejectionReason?: string;
  approvedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    image: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
    order: {
      type: Number,
      default: 999, // keep seller banners after admin banners unless reordered
    },
    isActive: {
      type: Boolean,
      default: false, // becomes active when approved
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    approvedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

PromotionSchema.index({ status: 1, isActive: 1, order: 1 });

const Promotion = mongoose.model<IPromotion>("Promotion", PromotionSchema);

export default Promotion;
