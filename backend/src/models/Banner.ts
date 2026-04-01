import mongoose, { Schema, Document } from "mongoose";

export interface IBanner extends Document {
  title: string;
  image: string;
  link?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: [true, "Banner title is required"],
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Banner image URL is required"],
    },
    link: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
BannerSchema.index({ order: 1, isActive: 1 });

const Banner = mongoose.model<IBanner>("Banner", BannerSchema);

export default Banner;
