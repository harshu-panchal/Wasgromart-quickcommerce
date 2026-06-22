import { getRazorpayClient, getRazorpayKeyId } from "../../../services/razorpayClient";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { CreateSubscriptionBody, RazorpaySubscriptionResponse } from "../types";

export class SubscriptionService {
  constructor(private repo: SubscriptionRepository) {}

  async createSubscription(sellerId: string, body: CreateSubscriptionBody) {
    const planId = String(body.planId || "").trim();
    if (!planId) {
      throw new Error("planId is required");
    }

    const totalCount = Number.isFinite(body.totalCount) && (body.totalCount as number) > 0
      ? Number(body.totalCount)
      : 12;

    const razorpay = getRazorpayClient();

    const notes: Record<string, any> = {
      sellerId,
      planId,
    };
    if (body.customer?.name) notes.customerName = body.customer.name;
    if (body.customer?.email) notes.customerEmail = body.customer.email;
    if (body.customer?.phone) notes.customerPhone = body.customer.phone;

    const subscription = (await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: totalCount,
      customer_notify: 1,
      notes,
    })) as RazorpaySubscriptionResponse;

    // Persist mapping immediately so webhook can update status later.
    await this.repo.setSellerSubscription(sellerId, {
      razorpaySubscriptionId: subscription.id,
      planId,
      isActive: false,
      status: undefined, // activated via webhook source of truth
      startDate: subscription.start_at ? new Date(subscription.start_at * 1000) : undefined,
      expiryDate: subscription.current_end ? new Date(subscription.current_end * 1000) : undefined,
      cancelledAt: null,
    });

    return {
      razorpaySubscriptionId: subscription.id,
      razorpayKey: getRazorpayKeyId(),
      status: subscription.status,
      planId: subscription.plan_id || planId,
      currentStart: subscription.current_start,
      currentEnd: subscription.current_end,
    };
  }

  async cancelSubscription(sellerId: string, subscriptionId?: string, cancelAtCycleEnd?: boolean) {
    const current = await this.repo.getSellerSubscription(sellerId);
    const existingId = current?.subscription?.razorpaySubscriptionId;
    const targetId = String(subscriptionId || existingId || "").trim();

    if (!targetId) {
      throw new Error("subscriptionId is required");
    }

    const razorpay = getRazorpayClient();
    const cancelled = (await razorpay.subscriptions.cancel(targetId, !!cancelAtCycleEnd)) as RazorpaySubscriptionResponse;

    await this.repo.setSellerSubscription(sellerId, {
      razorpaySubscriptionId: targetId,
      isActive: false,
      status: "Cancelled",
      cancelledAt: new Date(),
      expiryDate: cancelled.current_end ? new Date(cancelled.current_end * 1000) : undefined,
    });

    return {
      razorpaySubscriptionId: targetId,
      status: cancelled.status,
    };
  }

  async getSubscription(sellerId: string, subscriptionId: string) {
    const targetId = String(subscriptionId || "").trim();
    if (!targetId) {
      throw new Error("subscription id is required");
    }

    const current = await this.repo.getSellerSubscription(sellerId);
    const ownedId = current?.subscription?.razorpaySubscriptionId;
    if (!ownedId || ownedId !== targetId) {
      throw new Error("Unauthorized access to subscription");
    }

    const razorpay = getRazorpayClient();
    const subscription = (await razorpay.subscriptions.fetch(targetId)) as RazorpaySubscriptionResponse;

    return {
      razorpaySubscriptionId: subscription.id,
      status: subscription.status,
      planId: subscription.plan_id,
      currentStart: subscription.current_start,
      currentEnd: subscription.current_end,
      cancelledAt: subscription.cancelled_at,
    };
  }
}

