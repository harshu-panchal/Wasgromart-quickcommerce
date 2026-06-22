import crypto from "crypto";
import WebhookEvent, { IWebhookEvent } from "../../../models/WebhookEvent";

export class RazorpayWebhookEventRepository {
  /**
   * Derive a stable idempotency key when Razorpay doesn't provide an event id header.
   * Using a hash of the raw payload makes duplicate retries safe.
   */
  static computeEventIdFromRawBody(rawBody: Buffer): string {
    return crypto.createHash("sha256").update(rawBody).digest("hex");
  }

  /**
   * Try to "claim" processing for an event.
   * - If already processed, returns shouldProcess=false.
   * - If new or previously failed/skipped, marks it processing and returns shouldProcess=true.
   */
  async startProcessing(args: {
    provider: "razorpay";
    eventId: string;
    eventType: string;
    entityId?: string;
    payload?: any;
  }): Promise<{ shouldProcess: boolean; record: IWebhookEvent }> {
    const now = new Date();

    // First, check if already processed (fast skip path).
    const existingProcessed = await WebhookEvent.findOne({
      provider: args.provider,
      eventId: args.eventId,
      status: "processed",
    }).lean<IWebhookEvent>();

    if (existingProcessed) {
      return { shouldProcess: false, record: existingProcessed as any };
    }

    // Upsert + mark processing.
    // If it already exists but is not processed, we allow retry and increment attempts.
    const record = await WebhookEvent.findOneAndUpdate(
      { provider: args.provider, eventId: args.eventId },
      {
        $setOnInsert: {
          provider: args.provider,
          eventId: args.eventId,
          receivedAt: now,
        },
        $set: {
          eventType: args.eventType,
          entityId: args.entityId,
          status: "processing",
          processingAt: now,
          lastReceivedAt: now,
          payload: args.payload,
          lastError: undefined,
        },
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true }
    );

    return { shouldProcess: true, record };
  }

  async markProcessed(args: { provider: "razorpay"; eventId: string }) {
    await WebhookEvent.updateOne(
      { provider: args.provider, eventId: args.eventId },
      { $set: { status: "processed", processedAt: new Date() } }
    );
  }

  async markFailed(args: { provider: "razorpay"; eventId: string; error: string }) {
    await WebhookEvent.updateOne(
      { provider: args.provider, eventId: args.eventId },
      { $set: { status: "failed", lastError: args.error } }
    );
  }
}

