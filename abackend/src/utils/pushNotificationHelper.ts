import Customer from '../models/Customer';
import { sendPushNotification, PushNotificationPayload } from '../services/firebaseAdmin';

/**
 * Send notification to a specific user
 * @param userId - The ID of the user to send to
 * @param payload - Notification payload
 * @param includeMobile - Whether to include mobile tokens (default true)
 */
export async function sendNotificationToUser(userId: string, payload: PushNotificationPayload, includeMobile: boolean = true) {
    try {
        const user = await Customer.findById(userId);
        if (!user) {
            console.warn(`User not found for notification: ${userId}`);
            return;
        }

        let tokens: string[] = [];

        // Add Web Tokens
        // @ts-ignore - Fields will be added to model shortly
        if (user.notificationPreferences?.push !== false && user.fcmTokens && user.fcmTokens.length > 0) {
            // @ts-ignore
            tokens = [...tokens, ...user.fcmTokens];
        }

        // Add Mobile Tokens
        // @ts-ignore
        if (includeMobile && user.notificationPreferences?.push !== false && user.fcmTokenMobile && user.fcmTokenMobile.length > 0) {
            // @ts-ignore
            tokens = [...tokens, ...user.fcmTokenMobile];
        }

        // Remove duplicates
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            return; // No tokens to send to
        }

        console.log(`Sending notification to user ${userId} (${uniqueTokens.length} tokens)`);
        const response: any = await sendPushNotification(uniqueTokens, payload);

        const invalidTokens: string[] = response?.invalidTokens || [];
        if (invalidTokens.length > 0) {
            const invalidSet = new Set(invalidTokens);
            // @ts-ignore
            user.fcmTokens = (user.fcmTokens || []).filter((token: string) => !invalidSet.has(token));
            // @ts-ignore
            user.fcmTokenMobile = (user.fcmTokenMobile || []).filter((token: string) => !invalidSet.has(token));
            await user.save();
            console.log(`Removed ${invalidTokens.length} invalid FCM token(s) for user ${userId}`);
        }
    } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
        // Non-blocking error
    }
}
