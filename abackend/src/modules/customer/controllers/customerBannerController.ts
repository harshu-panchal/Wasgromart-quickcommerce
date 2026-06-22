import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Banner from "../../../models/Banner";

/**
 * Get all active banners (Public endpoint - no authentication required)
 */
export const getActiveBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await Banner.find({ isActive: true }).sort({ order: 1 });

  res.status(200).json({
    success: true,
    data: banners,
  });
});
