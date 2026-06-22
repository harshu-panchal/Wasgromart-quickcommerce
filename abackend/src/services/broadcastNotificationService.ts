import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Admin from "../models/Admin";
import { sendPushNotification } from "./firebaseAdmin";

/**
 * Reusable broadcast helper for the Admin → Notification flow.
 *
 * Token gather pattern factored out of routes/customerNotificationRoutes.ts
 * (the welcome blast) so that any admin-triggered notification can fan out
 * to FCM web + mobile devices for the chosen audience.
 *
 * Two audience shapes are supported:
 *   1. role: broadcast to every user in one of the role buckets, or All.
 *   2. user: target one specific user (across the four user collections).
 */

export type RoleAudience =
  | "All"
  | "Admin"
  | "Seller"
  | "Customer"
  | "Delivery";

export type UserCollection = "Admin" | "Seller" | "Customer" | "Delivery";

export type Audience =
  | { kind: "role"; role: RoleAudience }
  | { kind: "user"; userId: string; userType: UserCollection };

export interface BroadcastPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
  /**
   * When true (default), send a data-only FCM message so the SW (web) and
   * Flutter app (mobile) render the notification themselves. This avoids the
   * duplicate-notification issue where the SDK auto-displays the notification
   * block AND the app's handler also calls showNotification.
   */
  dataOnly?: boolean;
}

export interface BroadcastResult {
  targetedUsers: number;
  tokens: number;
  successCount: number;
  failureCount: number;
  invalidTokenCount: number;
}

interface TokenBucket {
  collection: UserCollection;
  userId: string;
  tokens: string[];
}

/**
 * Mongo $or filter that selects only documents that have at least one FCM
 * token in either the web array or the mobile array. Skipping users with
 * no tokens keeps the targetedUsers count honest.
 */
const HAS_ANY_TOKEN = {
  $or: [
    { fcmTokens: { $exists: true, $ne: [] } },
    { fcmTokenMobile: { $exists: true, $ne: [] } },
  ],
};

const TOKEN_PROJECTION = "fcmTokens fcmTokenMobile";

async function gatherFromRole(role: RoleAudience): Promise<TokenBucket[]> {
  const buckets: TokenBucket[] = [];

  const wantCustomer = role === "All" || role === "Customer";
  const wantSeller = role === "All" || role === "Seller";
  const wantDelivery = role === "All" || role === "Delivery";
  const wantAdmin = role === "All" || role === "Admin";

  const tasks: Array<Promise<void>> = [];

  if (wantCustomer) {
    tasks.push(
      Customer.find({
        ...HAS_ANY_TOKEN,
        // Respect the customer-only push preference. Default (undefined or true)
        // means push is allowed. Only an explicit `false` opts the user out.
        $and: [
          {
            $or: [
              { "notificationPreferences.push": { $exists: false } },
              { "notificationPreferences.push": { $ne: false } },
            ],
          },
        ],
      })
        .select(TOKEN_PROJECTION)
        .lean()
        .then((docs) => {
          for (const d of docs as any[]) {
            buckets.push({
              collection: "Customer",
              userId: String(d._id),
              tokens: [
                ...(d.fcmTokens || []),
                ...(d.fcmTokenMobile || []),
              ].filter(Boolean),
            });
          }
        }),
    );
  }

  if (wantSeller) {
    tasks.push(
      Seller.find(HAS_ANY_TOKEN)
        .select(TOKEN_PROJECTION)
        .lean()
        .then((docs) => {
          for (const d of docs as any[]) {
            buckets.push({
              collection: "Seller",
              userId: String(d._id),
              tokens: [
                ...(d.fcmTokens || []),
                ...(d.fcmTokenMobile || []),
              ].filter(Boolean),
            });
          }
        }),
    );
  }

  if (wantDelivery) {
    tasks.push(
      Delivery.find(HAS_ANY_TOKEN)
        .select(TOKEN_PROJECTION)
        .lean()
        .then((docs) => {
          for (const d of docs as any[]) {
            buckets.push({
              collection: "Delivery",
              userId: String(d._id),
              tokens: [
                ...(d.fcmTokens || []),
                ...(d.fcmTokenMobile || []),
              ].filter(Boolean),
            });
          }
        }),
    );
  }

  if (wantAdmin) {
    tasks.push(
      Admin.find(HAS_ANY_TOKEN)
        .select(TOKEN_PROJECTION)
        .lean()
        .then((docs) => {
          for (const d of docs as any[]) {
            buckets.push({
              collection: "Admin",
              userId: String(d._id),
              tokens: [
                ...(d.fcmTokens || []),
                ...(d.fcmTokenMobile || []),
              ].filter(Boolean),
            });
          }
        }),
    );
  }

  await Promise.all(tasks);
  return buckets;
}

async function gatherFromUser(
  userId: string,
  userType: UserCollection,
): Promise<TokenBucket[]> {
  const model =
    userType === "Customer"
      ? Customer
      : userType === "Seller"
        ? Seller
        : userType === "Delivery"
          ? Delivery
          : Admin;

  const doc = await (model as any)
    .findById(userId)
    .select(TOKEN_PROJECTION)
    .lean();
  if (!doc) return [];

  return [
    {
      collection: userType,
      userId: String(doc._id),
      tokens: [
        ...(doc.fcmTokens || []),
        ...(doc.fcmTokenMobile || []),
      ].filter(Boolean),
    },
  ];
}

/**
 * Remove invalid (unregistered) tokens reported by FCM from the source
 * collections so they don't waste future broadcast slots.
 */
async function cleanupInvalidTokens(invalidTokens: string[]): Promise<number> {
  if (invalidTokens.length === 0) return 0;
  const update = {
    $pull: { fcmTokens: { $in: invalidTokens }, fcmTokenMobile: { $in: invalidTokens } },
  };
  const results = await Promise.all([
    Customer.updateMany({}, update as any),
    Seller.updateMany({}, update as any),
    Delivery.updateMany({}, update as any),
    Admin.updateMany({}, update as any),
  ]);
  const touched = results.reduce(
    (acc, r: any) => acc + (r.modifiedCount || 0),
    0,
  );
  if (touched > 0) {
    console.log(
      `[${new Date().toISOString()}] Broadcast cleanup: removed invalid tokens from ${touched} user document(s)`,
    );
  }
  return touched;
}

/**
 * Broadcast a push notification to the requested audience.
 *
 * Always returns delivery stats. Never throws on FCM errors — callers can
 * surface partial failure in the admin UI without 500-ing the whole request.
 */
export async function broadcastPush(
  audience: Audience,
  payload: BroadcastPayload,
): Promise<BroadcastResult> {
  const buckets =
    audience.kind === "role"
      ? await gatherFromRole(audience.role)
      : await gatherFromUser(audience.userId, audience.userType);

  const targetedUsers = buckets.filter((b) => b.tokens.length > 0).length;

  // Flatten + dedupe across all buckets so a token that somehow appears on
  // two users only gets pushed once.
  const allTokens = [
    ...new Set(buckets.flatMap((b) => b.tokens).filter(Boolean)),
  ];

  if (allTokens.length === 0) {
    console.warn(
      `[${new Date().toISOString()}] broadcastPush: no FCM tokens found for audience ${JSON.stringify(
        audience,
      )}. Push skipped.`,
    );
    return {
      targetedUsers,
      tokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokenCount: 0,
    };
  }

  const CHUNK_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  // Default to data-only so we never hit the mixed-message duplicate. Callers
  // can opt back into notification+data mode by explicitly passing dataOnly:false.
  const useDataOnly = payload.dataOnly !== false;

  for (let i = 0; i < allTokens.length; i += CHUNK_SIZE) {
    const chunk = allTokens.slice(i, i + CHUNK_SIZE);
    try {
      const result: any = await sendPushNotification(chunk, {
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: payload.sound,
        dataOnly: useDataOnly,
      });
      successCount += result?.successCount || 0;
      failureCount += result?.failureCount || 0;
      if (Array.isArray(result?.invalidTokens)) {
        invalidTokens.push(...result.invalidTokens);
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] broadcastPush chunk failed:`,
        error,
      );
      failureCount += chunk.length;
    }
  }

  const uniqueInvalid = [...new Set(invalidTokens)];
  if (uniqueInvalid.length > 0) {
    try {
      await cleanupInvalidTokens(uniqueInvalid);
    } catch (cleanupError) {
      console.error(
        `[${new Date().toISOString()}] broadcastPush cleanup failed:`,
        cleanupError,
      );
    }
  }

  return {
    targetedUsers,
    tokens: allTokens.length,
    successCount,
    failureCount,
    invalidTokenCount: uniqueInvalid.length,
  };
}
