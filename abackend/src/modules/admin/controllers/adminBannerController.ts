import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Banner from "../../../models/Banner";

/**
 * Get all banners (Admin)
 */
export const getAllBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await Banner.find().sort({ order: 1 });
  res.status(200).json({
    success: true,
    data: banners,
  });
});

/**
 * Create a new banner
 */
export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const { title, image, link, order, isActive } = req.body;

  if (!title || !image) {
    res.status(400).json({
      success: false,
      message: "Title and image are required",
    });
    return;
  }

  const banner = await Banner.create({
    title,
    image,
    link,
    order: order || 0,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    success: true,
    data: banner,
  });
});

/**
 * Update a banner
 */
export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, image, link, order, isActive } = req.body;

  const banner = await Banner.findById(id);

  if (!banner) {
    res.status(404).json({
      success: false,
      message: "Banner not found",
    });
    return;
  }

  if (title) banner.title = title;
  if (image) banner.image = image;
  if (link !== undefined) banner.link = link;
  if (order !== undefined) banner.order = order;
  if (isActive !== undefined) banner.isActive = isActive;

  await banner.save();

  res.status(200).json({
    success: true,
    data: banner,
  });
});

/**
 * Delete a banner
 */
export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const banner = await Banner.findByIdAndDelete(id);

  if (!banner) {
    res.status(404).json({
      success: false,
      message: "Banner not found",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Banner deleted successfully",
  });
});
