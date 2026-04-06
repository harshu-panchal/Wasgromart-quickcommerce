import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { SubscriptionService } from "../services/subscriptionService";
import { CancelSubscriptionBody, CreateSubscriptionBody, GetSubscriptionParams } from "../types";

const repo = new SubscriptionRepository();
const service = new SubscriptionService(repo);

export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.user?.userId;
  if (!sellerId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const body = (req.body || {}) as CreateSubscriptionBody;
  const result = await service.createSubscription(sellerId, body);

  return res.status(200).json({
    success: true,
    message: "Subscription created",
    data: result,
  });
});

export const cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.user?.userId;
  if (!sellerId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const body = (req.body || {}) as CancelSubscriptionBody;
  const result = await service.cancelSubscription(
    sellerId,
    body.subscriptionId,
    body.cancelAtCycleEnd
  );

  return res.status(200).json({
    success: true,
    message: "Subscription cancelled",
    data: result,
  });
});

export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.user?.userId;
  if (!sellerId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const params = req.params as unknown as GetSubscriptionParams;
  try {
    const result = await service.getSubscription(sellerId, params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    const msg = err?.message || "Failed to fetch subscription";
    const isForbidden = msg.toLowerCase().includes("unauthorized");
    return res.status(isForbidden ? 403 : 400).json({ success: false, message: msg });
  }
});

