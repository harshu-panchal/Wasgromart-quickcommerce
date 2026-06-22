import mongoose, { Document, Schema } from "mongoose";

export type SupportSenderType = "Seller" | "Admin";

export interface ISupportConversation extends Document {
  seller: mongoose.Types.ObjectId;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: SupportSenderType;
  unreadForAdmin: number;
  unreadForSeller: number;
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupportConversationSchema = new Schema<ISupportConversation>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: [true, "Seller is required"],
      unique: true,
      index: true,
    },
    lastMessage: {
      type: String,
      trim: true,
    },
    lastMessageAt: {
      type: Date,
    },
    lastMessageBy: {
      type: String,
      enum: ["Seller", "Admin"],
    },
    unreadForAdmin: {
      type: Number,
      default: 0,
      min: 0,
    },
    unreadForSeller: {
      type: Number,
      default: 0,
      min: 0,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

SupportConversationSchema.index({ lastMessageAt: -1 });

const SupportConversation = mongoose.model<ISupportConversation>(
  "SupportConversation",
  SupportConversationSchema
);

export default SupportConversation;
