import { Request, Response } from "express";
import { Types } from "mongoose";
import Promotion from "../../../models/Promotion";
import { asyncHandler } from "../../../utils/asyncHandler";

export const listPromotionRequests = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  const filter: Record<string, any> = {};

  if (status && typeof status === "string") {
    filter.status = status;
  }

  const promotions = await Promotion.find(filter)
    .populate("seller", "sellerName storeName logo")
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    message: "Promotion requests fetched",
    data: promotions,
  });
});

export const approvePromotionRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { order, link, title } = req.body;
  const adminId = req.user?.userId;

  const promotion = await Promotion.findById(id);
  if (!promotion) {
    return res.status(404).json({ success: false, message: "Promotion not found" });
  }

  promotion.status = "Approved";
  promotion.isActive = true;
  promotion.approvedAt = new Date();
  if (adminId) {
    promotion.reviewedBy = new Types.ObjectId(adminId);
  }
  if (typeof order === "number") {
    promotion.order = order;
  }
  if (typeof link === "string" && link.trim().length > 0) {
    promotion.link = link.trim();
  }
  if (typeof title === "string" && title.trim().length > 0) {
    promotion.title = title.trim();
  }
  promotion.rejectionReason = undefined;

  await promotion.save();

  res.status(200).json({
    success: true,
    message: "Promotion approved",
    data: promotion,
  });
});

export const rejectPromotionRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user?.userId;

  const promotion = await Promotion.findById(id);
  if (!promotion) {
    return res.status(404).json({ success: false, message: "Promotion not found" });
  }

  promotion.status = "Rejected";
  promotion.isActive = false;
  promotion.rejectionReason = reason || "";
  if (adminId) {
    promotion.reviewedBy = new Types.ObjectId(adminId);
  }
  promotion.approvedAt = undefined;

  await promotion.save();

  res.status(200).json({
    success: true,
    message: "Promotion rejected",
    data: promotion,
  });
});

export const updatePromotionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive, order } = req.body;

  const promotion = await Promotion.findById(id);
  if (!promotion) {
    return res.status(404).json({ success: false, message: "Promotion not found" });
  }

  if (typeof isActive === "boolean") {
    promotion.isActive = isActive;
  }
  if (typeof order === "number") {
    promotion.order = order;
  }

  await promotion.save();

  res.status(200).json({
    success: true,
    message: "Promotion updated",
    data: promotion,
  });
});
