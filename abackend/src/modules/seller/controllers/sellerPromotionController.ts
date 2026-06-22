import { Request, Response } from "express";
import Promotion from "../../../models/Promotion";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";

export const createPromotionRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.userType !== "Seller") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can create promotion requests",
      });
    }

    const { title, image, link, order } = req.body;

    if (!title || !image) {
      return res.status(400).json({
        success: false,
        message: "Title and image are required",
      });
    }

    // Optional: ensure seller exists
    const seller = await Seller.findById(user.userId).select("storeName");
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const defaultLink = `/store/${seller._id.toString()}`;

    const promotion = await Promotion.create({
      seller: seller._id,
      title,
      image,
      link: link || defaultLink,
      order: typeof order === "number" ? order : 999,
      status: "Pending",
      isActive: false,
    });

    res.status(201).json({
      success: true,
      message: "Promotion request submitted successfully",
      data: promotion,
    });
  }
);

export const getMyPromotions = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || user.userType !== "Seller") {
    return res.status(403).json({
      success: false,
      message: "Only sellers can view promotions",
    });
  }

  const promotions = await Promotion.find({ seller: user.userId })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    message: "Promotions fetched",
    data: promotions,
  });
});
