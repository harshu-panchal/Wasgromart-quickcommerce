import mongoose, { Document, Schema } from "mongoose";

export type WebhookProvider = "razorpay";
export type WebhookEventStatus = "processing" | "processed" | "failed" | "skipped";

export interface IWebhookEvent extends Document {
  provider: WebhookProvider;
  eventId: string; // idempotency key (header event id or payload hash)
  eventType: string;
  entityId?: string; // payment_id / subscription_id / invoice_id etc.

  status: WebhookEventStatus;
  attempts: number;
  processingAt?: Date;
  processedAt?: Date;
  lastError?: string;

  receivedAt: Date;
  lastReceivedAt: Date;

  // Keep payload for debugging/auditing (can be trimmed later if needed)
  payload?: any;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    provider: {
      type: String,
      required: true,
      enum: ["razorpay"],
      index: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["processing", "processed", "failed", "skipped"],
      default: "processing",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    processingAt: Date,
    processedAt: Date,
    lastError: String,
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastReceivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    payload: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Idempotency: provider + eventId must be unique.
WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const WebhookEvent =
  mongoose.models.WebhookEvent ||
  mongoose.model<IWebhookEvent>("WebhookEvent", WebhookEventSchema);

export default WebhookEvent;

