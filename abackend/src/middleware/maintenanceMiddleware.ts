import { Request, Response, NextFunction } from "express";
import AppSettings from "../models/AppSettings";

/**
 * Middleware to intercept customer API requests when maintenance mode is active.
 * Allows requests to proceed if user is an Admin or if maintenance mode is disabled.
 */
export const checkMaintenanceMode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // If request comes from an authenticated Admin, bypass maintenance mode
    if (req.user && req.user.userType === "Admin") {
      return next();
    }

    const settings = await AppSettings.getSettings();

    if (settings && settings.maintenanceMode) {
      return res.status(503).json({
        success: false,
        maintenanceMode: true,
        message:
          settings.maintenanceMessage ||
          "Our system is currently undergoing scheduled maintenance. We'll be back shortly!",
        code: "MAINTENANCE_MODE_ACTIVE",
      });
    }

    return next();
  } catch (error) {
    // In case of error reading settings, allow request to proceed to avoid breaking API
    console.error("Error checking maintenance mode in middleware:", error);
    return next();
  }
};
