import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Notification from "../../../models/Notification";
import {
  broadcastPush,
  Audience,
  RoleAudience,
  UserCollection,
  BroadcastResult,
} from "../../../services/broadcastNotificationService";

const ROLE_AUDIENCES: ReadonlySet<RoleAudience> = new Set([
  "All",
  "Admin",
  "Seller",
  "Customer",
  "Delivery",
]);
const USER_COLLECTIONS: ReadonlySet<UserCollection> = new Set([
  "Admin",
  "Seller",
  "Customer",
  "Delivery",
]);

/**
 * Create a new notification AND broadcast it via FCM to the chosen audience.
 *
 * Body:
 *   - recipientType: "All" | "Admin" | "Seller" | "Customer" | "Delivery"
 *   - recipientId?: ObjectId — when present, the broadcast is targeted at a
 *     single user. recipientType must be the user's collection
 *     (Admin/Seller/Customer/Delivery, never "All").
 *   - title, message, type?, link?, actionLabel?, priority?, expiresAt?
 *
 * Response includes a `push` block with delivery stats so the admin UI can
 * surface real numbers (targeted users / devices / success / failure).
 */
export const createNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      recipientType,
      recipientId,
      title,
      message,
      type,
      link,
      actionLabel,
      priority,
      expiresAt,
    } = req.body;

    if (!recipientType || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Recipient type, title, and message are required",
      });
    }

    if (!ROLE_AUDIENCES.has(recipientType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid recipientType: ${recipientType}`,
      });
    }

    if (recipientId) {
      if (recipientType === "All") {
        return res.status(400).json({
          success: false,
          message:
            "recipientId is not allowed when recipientType is 'All'. Pick a specific user type.",
        });
      }
      if (!USER_COLLECTIONS.has(recipientType)) {
        return res.status(400).json({
          success: false,
          message:
            "recipientType must be Admin/Seller/Customer/Delivery when targeting a specific user.",
        });
      }
    }

    const notification = await Notification.create({
      recipientType,
      recipientId,
      title,
      message,
      type: type || "Info",
      link,
      actionLabel,
      priority: priority || "Medium",
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user?.userId,
      isRead: false,
    });

    // Fire the FCM broadcast. Wrapped so a Firebase outage doesn't 500 the
    // create request — the DB row is the source of truth, push is best-effort.
    let pushStats: BroadcastResult = {
      targetedUsers: 0,
      tokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokenCount: 0,
    };

    try {
      const audience: Audience = recipientId
        ? {
            kind: "user",
            userId: String(recipientId),
            userType: recipientType as UserCollection,
          }
        : { kind: "role", role: recipientType as RoleAudience };

      pushStats = await broadcastPush(audience, {
        title,
        body: message,
        data: {
          notificationId: String(notification._id),
          type: "admin_broadcast",
          recipientType: String(recipientType),
          link: link ? String(link) : "",
        },
      });

      notification.sentAt = new Date();
      await notification.save();
    } catch (pushError) {
      console.error(
        `[${new Date().toISOString()}] Broadcast push failed for notification ${notification._id}:`,
        pushError,
      );
    }

    return res.status(201).json({
      success: true,
      message: "Notification created and broadcast",
      data: notification,
      push: pushStats,
    });
  }
);

/**
 * Get all notifications
 */
export const getNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      recipientType,
      recipientId,
      isRead,
      type,
      priority,
    } = req.query;

    const query: any = {};

    if (recipientType) query.recipientType = recipientType;
    if (recipientId) query.recipientId = recipientId;
    if (isRead !== undefined) query.isRead = isRead === "true";
    if (type) query.type = type;
    if (priority) query.priority = priority;

    // Filter expired notifications
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gte: new Date() } },
    ];

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Notification.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get notification by ID
 */
export const getNotificationById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findById(id).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification fetched successfully",
      data: notification,
    });
  }
);

/**
 * Mark notification as read
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndUpdate(
    id,
    {
      isRead: true,
      readAt: new Date(),
    },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

/**
 * Update notification
 */
export const updateNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const notification = await Notification.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: notification,
    });
  }
);

/**
 * Re-broadcast an existing notification via FCM. Useful for retrying a row
 * that was created when Firebase was down, or for resending an old one.
 */
export const sendNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    let pushStats: BroadcastResult = {
      targetedUsers: 0,
      tokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokenCount: 0,
    };

    try {
      const audience: Audience = notification.recipientId
        ? {
            kind: "user",
            userId: String(notification.recipientId),
            userType: notification.recipientType as UserCollection,
          }
        : {
            kind: "role",
            role: notification.recipientType as RoleAudience,
          };

      pushStats = await broadcastPush(audience, {
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: String(notification._id),
          type: "admin_broadcast",
          recipientType: String(notification.recipientType),
          link: notification.link ? String(notification.link) : "",
        },
      });

      notification.sentAt = new Date();
      await notification.save();
    } catch (pushError) {
      console.error(
        `[${new Date().toISOString()}] Re-broadcast push failed for notification ${id}:`,
        pushError,
      );
    }

    return res.status(200).json({
      success: true,
      message: "Notification broadcast triggered",
      data: notification,
      push: pushStats,
    });
  }
);

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Notification IDs array is required",
      });
    }

    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modified: result.modifiedCount,
      },
    });
  }
);

/**
 * Delete notification
 */
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  }
);
