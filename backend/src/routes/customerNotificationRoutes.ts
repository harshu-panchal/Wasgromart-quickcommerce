import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import Notification from "../models/Notification";
import { sendPushNotification } from "../services/firebaseAdmin";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Admin from "../models/Admin";
import { Request, Response } from "express";

const router = Router();

// POST /customer/notifications/welcome
// Authenticated customers can trigger a welcome push notification to all users
router.post(
  "/welcome",
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    // Save notification record to DB
    const notification = await Notification.create({
      recipientType: "All",
      title: "Welcome to WasgroMart! 🎉",
      message:
        "Thank you for joining WasgroMart. Explore fresh groceries, great deals, and fast delivery right to your door!",
      type: "Info",
      priority: "High",
      isRead: false,
      sentAt: new Date(),
    });

    // Gather all FCM tokens from every user type
    const [customers, sellers, deliveries, admins] = await Promise.all([
      Customer.find({ $or: [{ fcmTokens: { $exists: true, $ne: [] } }, { fcmTokenMobile: { $exists: true, $ne: [] } }] })
        .select("fcmTokens fcmTokenMobile").lean(),
      Seller.find({ $or: [{ fcmTokens: { $exists: true, $ne: [] } }, { fcmTokenMobile: { $exists: true, $ne: [] } }] })
        .select("fcmTokens fcmTokenMobile").lean(),
      Delivery.find({ $or: [{ fcmTokens: { $exists: true, $ne: [] } }, { fcmTokenMobile: { $exists: true, $ne: [] } }] })
        .select("fcmTokens fcmTokenMobile").lean(),
      Admin.find({ $or: [{ fcmTokens: { $exists: true, $ne: [] } }, { fcmTokenMobile: { $exists: true, $ne: [] } }] })
        .select("fcmTokens fcmTokenMobile").lean(),
    ]);

    const allUsers = [...customers, ...sellers, ...deliveries, ...admins] as any[];
    const allTokens = [
      ...new Set(
        allUsers.flatMap((u) => [
          ...(u.fcmTokens || []),
          ...(u.fcmTokenMobile || []),
        ]).filter(Boolean)
      ),
    ] as string[];

    let pushResult = { successCount: 0, failureCount: 0 };

    if (allTokens.length > 0) {
      // Firebase allows max 500 tokens per multicast — chunk if needed
      const CHUNK_SIZE = 500;
      for (let i = 0; i < allTokens.length; i += CHUNK_SIZE) {
        const chunk = allTokens.slice(i, i + CHUNK_SIZE);
        const result: any = await sendPushNotification(chunk, {
          title: "Welcome to WasgroMart! 🎉",
          body: "Thank you for joining WasgroMart. Explore fresh groceries, great deals, and fast delivery right to your door!",
          data: {
            type: "welcome",
            link: "/",
            notificationId: notification._id.toString(),
          },
        });
        pushResult.successCount += result?.successCount || 0;
        pushResult.failureCount += result?.failureCount || 0;
      }
    }

    return res.status(201).json({
      success: true,
      message: "Welcome notification sent successfully",
      data: notification,
      push: {
        totalTokens: allTokens.length,
        successCount: pushResult.successCount,
        failureCount: pushResult.failureCount,
      },
    });
  })
);

export default router;
