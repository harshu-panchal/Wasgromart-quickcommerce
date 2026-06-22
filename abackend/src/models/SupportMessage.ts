import mongoose, { Document, Schema } from "mongoose";
import { SupportSenderType } from "./SupportConversation";

export interface ISupportMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  senderType: SupportSenderType;
  senderId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportMessageSchema = new Schema<ISupportMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "SupportConversation",
      required: [true, "Conversation is required"],
      index: true,
    },
    senderType: {
      type: String,
      enum: ["Seller", "Admin"],
      required: [true, "Sender type is required"],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: [true, "Sender id is required"],
    },
    text: {
      type: String,
      required: [true, "Message text is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

SupportMessageSchema.index({ conversation: 1, createdAt: 1 });

const SupportMessage = mongoose.model<ISupportMessage>(
  "SupportMessage",
  SupportMessageSchema
);

export default SupportMessage;
