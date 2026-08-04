import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import AppSettings from "../models/AppSettings";

/**
 * Get public app configuration for clients (Customer app, Delivery app, Web)
 * Unauthenticated endpoint
 */
export const getPublicConfig = asyncHandler(
  async (_req: Request, res: Response) => {
    let settings = await AppSettings.findOne();

    if (!settings) {
      settings = await AppSettings.create({
        appName: "Wasgromart",
        contactEmail: "contact@wasgromart.com",
        contactPhone: "8999475858",
        supportEmail: "support@wasgromart.com",
        supportPhone: "9579257390",
        maintenanceMode: false,
        maintenanceMessage: "",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Public config fetched successfully",
      data: {
        appName: settings.appName,
        appLogo: settings.appLogo,
        appFavicon: settings.appFavicon,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        maintenanceMode: settings.maintenanceMode || false,
        maintenanceMessage:
          settings.maintenanceMessage ||
          "Our system is currently undergoing scheduled maintenance. We'll be back shortly!",
        features: settings.features || {
          sellerRegistration: true,
          productApproval: true,
          orderTracking: true,
          wallet: true,
          coupons: true,
        },
      },
    });
  }
);
