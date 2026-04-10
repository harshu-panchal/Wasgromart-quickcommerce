import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isFirebaseInitialized = false;

try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT is not set. Push notifications are disabled.');
    } else {
        const envVal = process.env.FIREBASE_SERVICE_ACCOUNT;
        // Log first 80 chars to diagnose hosting panel mangling
        console.log('[Firebase] Raw env value (first 80 chars):', JSON.stringify(envVal.substring(0, 80)));

        // Hosting panels often mangle the JSON value by:
        // 1. Wrapping in single quotes: '{"type":...}'
        // 2. Escaping double quotes with backslashes: \{"type\": \"service_account\"...}
        // Strip both before parsing
        const raw = envVal
            .trim()
            .replace(/^'([\s\S]*)'$/, '$1')  // remove surrounding single quotes
            .replace(/\\"/g, '"')             // unescape \" → "
            .replace(/^\\{/, '{')             // fix leading \{
            .replace(/\\}$/, '}');            // fix trailing \}

        console.log('[Firebase] Cleaned value (first 80 chars):', JSON.stringify(raw.substring(0, 80)));
        const serviceAccount = JSON.parse(raw);

        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }

        isFirebaseInitialized = true;
        console.log('✅ Firebase Admin SDK initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: { [key: string]: string };
}

const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
]);

/**
 * Send push notification to multiple tokens
 */
export async function sendPushNotification(tokens: string[], payload: PushNotificationPayload) {
    if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };

    if (!isFirebaseInitialized) {
        console.warn(`[${new Date().toISOString()}] Firebase not initialized. Cannot send to ${tokens.length} tokens.`);
        return { successCount: 0, failureCount: tokens.length };
    }

    try {
        const normalizedDataEntries = Object.entries(payload.data || {}).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
        ]);
        const messageData: { [key: string]: string } = {
            ...Object.fromEntries(normalizedDataEntries),
            title: String(payload.title),
            body: String(payload.body),
        };

        const message: any = {
            data: messageData,
            tokens: tokens,
            // Mobile Specifics
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'kosil_notifications', // Ensure this matches your Flutter side channel if defined
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true,
                    },
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        const invalidTokens: string[] = [];
        const perTokenErrors: Array<{ token: string; code?: string; message?: string }> = [];

        response.responses.forEach((sendResponse, index) => {
            if (sendResponse.success) {
                return;
            }

            const token = tokens[index];
            const code = sendResponse.error?.code;
            const message = sendResponse.error?.message;
            perTokenErrors.push({ token, code, message });

            if (code && INVALID_TOKEN_ERROR_CODES.has(code)) {
                invalidTokens.push(token);
            }
        });

        console.log(
            `[${new Date().toISOString()}] FCM Send to ${tokens.length} tokens: ` +
            `${response.successCount} success, ${response.failureCount} failure`
        );
        if (perTokenErrors.length > 0) {
            console.warn(
                `[${new Date().toISOString()}] FCM token send errors:`,
                perTokenErrors.map((entry) => ({
                    tokenPreview: `${entry.token.slice(0, 12)}...`,
                    code: entry.code,
                    message: entry.message,
                }))
            );
        }

        (response as any).invalidTokens = [...new Set(invalidTokens)];

        return response;
    } catch (error) {
        console.error('Error sending push notification:', error);
        throw error;
    }
}
