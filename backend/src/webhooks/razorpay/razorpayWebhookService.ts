import crypto from "crypto";
import Payment from "../../models/Payment";
import Order from "../../models/Order";
import { RazorpayWebhookEventRepository } from "./repositories/razorpayWebhookEventRepository";
import { SellerSubscriptionRepository } from "./repositories/sellerSubscriptionRepository";
import {
  RazorpayWebhookEnvelope,
  RazorpayEventType,
  RazorpayPaymentEntity,
  RazorpaySubscriptionEntity,
  RazorpayInvoiceEntity,
} from "./types";

export class RazorpayWebhookService {
  constructor(
    private eventRepo: RazorpayWebhookEventRepository,
    private sellerSubRepo: SellerSubscriptionRepository
  ) {}

  verifySignature(args: { rawBody: Buffer; signature: string; webhookSecret: string }): boolean {
    const expected = crypto
      .createHmac("sha256", args.webhookSecret)
      .update(args.rawBody)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(args.signature));
    } catch {
      return false;
    }
  }

  async handleWebhook(args: {
    rawBody: Buffer;
    signature: string;
    eventId: string;
    webhookSecret: string;
  }): Promise<{ ok: boolean; skipped?: boolean }> {
    const isValid = this.verifySignature({
      rawBody: args.rawBody,
      signature: args.signature,
      webhookSecret: args.webhookSecret,
    });

    if (!isValid) {
      return { ok: false };
    }

    const payload = JSON.parse(args.rawBody.toString("utf8")) as RazorpayWebhookEnvelope;
    const eventType = payload.event as RazorpayEventType;

    const { entityId } = this.extractEntityInfo(payload);

    const started = await this.eventRepo.startProcessing({
      provider: "razorpay",
      eventId: args.eventId,
      eventType,
      entityId,
      payload,
    });

    if (!started.shouldProcess) {
      return { ok: true, skipped: true };
    }

    try {
      await this.dispatchEvent(payload, eventType);
      await this.eventRepo.markProcessed({ provider: "razorpay", eventId: args.eventId });
      return { ok: true };
    } catch (err: any) {
      await this.eventRepo.markFailed({
        provider: "razorpay",
        eventId: args.eventId,
        error: err?.message || String(err),
      });
      throw err;
    }
  }

  private extractEntityInfo(payload: RazorpayWebhookEnvelope): { entityId?: string } {
    const payment = payload.payload?.payment?.entity as RazorpayPaymentEntity | undefined;
    if (payment?.id) return { entityId: payment.id };
    const subscription = payload.payload?.subscription?.entity as RazorpaySubscriptionEntity | undefined;
    if (subscription?.id) return { entityId: subscription.id };
    const invoice = payload.payload?.invoice?.entity as RazorpayInvoiceEntity | undefined;
    if (invoice?.id) return { entityId: invoice.id };
    return { entityId: undefined };
  }

  private async dispatchEvent(payload: RazorpayWebhookEnvelope, eventType: RazorpayEventType) {
    switch (eventType) {
      case "payment.captured":
        await this.handlePaymentCaptured(payload);
        return;
      case "subscription.activated":
        await this.handleSubscriptionActivated(payload);
        return;
      case "subscription.cancelled":
        await this.handleSubscriptionCancelled(payload);
        return;
      case "invoice.paid":
        await this.handleInvoicePaid(payload);
        return;
      default:
        // Keep webhook fast; ignore events we don't care about.
        return;
    }
  }

  private async handlePaymentCaptured(payload: RazorpayWebhookEnvelope) {
    const entity = payload.payload?.payment?.entity as RazorpayPaymentEntity | undefined;
    if (!entity?.id) return;

    // Existing order-payment flow support:
    // - Update payment record if it exists (by razorpayOrderId or razorpayPaymentId)
    const razorpayOrderId = entity.order_id;
    const razorpayPaymentId = entity.id;

    const payment =
      (razorpayOrderId ? await Payment.findOne({ razorpayOrderId }) : null) ||
      (await Payment.findOne({ razorpayPaymentId }));

    if (payment) {
      payment.status = "Completed";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.paidAt = new Date();
      payment.gatewayResponse = {
        success: true,
        message: "Webhook: payment.captured",
        rawResponse: entity,
      };
      await payment.save();

      // If this payment is tied to an order, mark it Paid.
      if (payment.order) {
        await Order.findByIdAndUpdate(payment.order, {
          paymentStatus: "Paid",
          paymentId: razorpayPaymentId,
        });
      }
    }
  }

  private async handleSubscriptionActivated(payload: RazorpayWebhookEnvelope) {
    const entity = payload.payload?.subscription?.entity as RazorpaySubscriptionEntity | undefined;
    if (!entity?.id) return;

    const notes = entity.notes || {};
    const sellerIdFromNotes = String(notes.sellerId || notes.seller_id || "");
    const sellerId =
      sellerIdFromNotes || (await this.sellerSubRepo.findSellerIdByRazorpaySubscriptionId(entity.id));
    if (!sellerId) return;

    const startTs = entity.current_start ?? entity.start_at;
    const endTs = entity.current_end;

    await this.sellerSubRepo.updateBySellerId(sellerId, {
      isActive: true,
      status: "Active",
      planId: String(notes.planId || notes.plan_id || entity.plan_id || ""),
      razorpaySubscriptionId: entity.id,
      razorpayCustomerId: entity.customer_id,
      startDate: startTs ? new Date(startTs * 1000) : undefined,
      expiryDate: endTs ? new Date(endTs * 1000) : undefined,
      cancelledAt: null,
    });
  }

  private async handleSubscriptionCancelled(payload: RazorpayWebhookEnvelope) {
    const entity = payload.payload?.subscription?.entity as RazorpaySubscriptionEntity | undefined;
    if (!entity?.id) return;

    const notes = entity.notes || {};
    const sellerIdFromNotes = String(notes.sellerId || notes.seller_id || "");
    const sellerId =
      sellerIdFromNotes || (await this.sellerSubRepo.findSellerIdByRazorpaySubscriptionId(entity.id));
    if (!sellerId) return;

    const cancelledTs = entity.cancelled_at ?? entity.ended_at;

    await this.sellerSubRepo.updateBySellerId(sellerId, {
      isActive: false,
      status: "Cancelled",
      razorpaySubscriptionId: entity.id,
      cancelledAt: cancelledTs ? new Date(cancelledTs * 1000) : new Date(),
    });
  }

  private async handleInvoicePaid(payload: RazorpayWebhookEnvelope) {
    const entity = payload.payload?.invoice?.entity as RazorpayInvoiceEntity | undefined;
    if (!entity?.id) return;

    const notes = entity.notes || {};
    const sellerIdFromNotes = String(notes.sellerId || notes.seller_id || "");
    const sellerId =
      sellerIdFromNotes ||
      (entity.subscription_id
        ? await this.sellerSubRepo.findSellerIdByRazorpaySubscriptionId(entity.subscription_id)
        : null);
    if (!sellerId) return;

    // Renewal: keep it idempotent and minimal.
    // If Razorpay includes subscription entity in this webhook, use it to refresh expiryDate safely.
    const subscription = payload.payload?.subscription?.entity as RazorpaySubscriptionEntity | undefined;
    const endTs = subscription?.current_end;

    await this.sellerSubRepo.updateBySellerId(sellerId, {
      isActive: true,
      status: "Active",
      lastInvoiceId: entity.id,
      lastPaymentId: entity.payment_id,
      razorpaySubscriptionId: entity.subscription_id,
      expiryDate: endTs ? new Date(endTs * 1000) : undefined,
    });
  }
}
