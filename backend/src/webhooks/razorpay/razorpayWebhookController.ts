import { Request, Response } from "express";
import { RazorpayWebhookEventRepository } from "./repositories/razorpayWebhookEventRepository";
import { RazorpayWebhookService } from "./razorpayWebhookService";
import { SellerSubscriptionRepository } from "./repositories/sellerSubscriptionRepository";

const eventRepo = new RazorpayWebhookEventRepository();
const sellerSubRepo = new SellerSubscriptionRepository();
const service = new RazorpayWebhookService(eventRepo, sellerSubRepo);

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  const signature = String(req.headers["x-razorpay-signature"] || "");
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error("[RazorpayWebhook] Missing RAZORPAY_WEBHOOK_SECRET");
    return res.status(500).json({ success: false, message: "Webhook secret not configured" });
  }

  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing webhook signature" });
  }

  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    // We rely on raw body bytes for signature verification. This should never happen
    // if server.ts is configured with express.json({ verify }) for this endpoint.
    console.error("[RazorpayWebhook] Missing rawBody buffer");
    return res.status(400).json({ success: false, message: "Invalid webhook payload" });
  }

  const headerEventId = String(req.headers["x-razorpay-event-id"] || "").trim();
  const eventId =
    headerEventId || RazorpayWebhookEventRepository.computeEventIdFromRawBody(rawBody);

  const startedAt = Date.now();
  try {
    const result = await service.handleWebhook({
      rawBody,
      signature,
      webhookSecret,
      eventId,
    });

    const ms = Date.now() - startedAt;
    console.log("[RazorpayWebhook] ok", { eventId, ms, skipped: !!result.skipped });

    // Razorpay expects 2xx quickly; we always ACK on successful verification + processing.
    return res.status(200).json({ success: true });
  } catch (err: any) {
    const ms = Date.now() - startedAt;
    console.error("[RazorpayWebhook] failed", { eventId, ms, error: err?.message || err });

    // Return 500 so Razorpay retries. Idempotency will prevent duplicate side-effects.
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

