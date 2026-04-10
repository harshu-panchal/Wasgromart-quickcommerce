import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isFirebaseInitialized = false;

try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT is not set. Push notifications are disabled.');
    } else {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();

        // Log exact bytes around position 2282 to diagnose private_key mangling
        console.log('[Firebase] Length:', raw.length);
        console.log('[Firebase] First 100 chars:', JSON.stringify(raw.substring(0, 100)));
        console.log('[Firebase] Chars 2270-2300:', JSON.stringify(raw.substring(2270, 2300)));

        // Strip surrounding single quotes
        if (raw.startsWith("'")) raw = raw.slice(1);
        if (raw.endsWith("'"))   raw = raw.slice(0, -1);

        // Strip leading backslash-brace \{ → {
        if (raw.startsWith('\\{')) raw = '{' + raw.slice(2);

        // Unescape all \" → "
        raw = raw.replace(/\\"/g, '"');

        // Fix double-escaped newlines \\n → \n
        raw = raw.replace(/\\\\n/g, '\\n');

        // Fix invalid \% escape (Hostinger escapes % in URLs, e.g. \%40 → %40)
        raw = raw.replace(/\\%/g, '%');

        console.log('[Firebase] After cleanup, chars 2270-2300:', JSON.stringify(raw.substring(2270, 2300)));

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
