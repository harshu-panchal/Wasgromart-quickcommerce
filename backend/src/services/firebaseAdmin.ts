import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isFirebaseInitialized = false;

try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT is not set. Push notifications are disabled.');
    } else {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();

        // Hostinger mangles JSON env values with shell-escaping:
        // '\{\"type\": \"service_account\", ..., \"client_x509_cert_url\": \"https://...%40...\"}' 
        // Fix each mangling pattern:
        if (raw.startsWith("'")) raw = raw.slice(1);          // strip leading '
        if (raw.endsWith("'"))   raw = raw.slice(0, -1);      // strip trailing '
        if (raw.startsWith('\\{')) raw = '{' + raw.slice(2);  // \{ → {
        raw = raw.replace(/\\"/g, '"');                        // \" → "
        raw = raw.replace(/\\\\n/g, '\\n');                   // \\n → \n
        raw = raw.replace(/\\%/g, '%');                        // \% → %
        raw = raw.trimEnd().replace(/['\s]+$/, '').replace(/\\}$/, '}'); // clean trailing

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
    sound?: string; // custom sound filename without extension (e.g. 'seller_alert')
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
            // Top-level notification block — required for Flutter/native apps to
            // auto-display the notification without any Flutter-side handling code
            notification: {
                title: String(payload.title),
                body: String(payload.body),
            },
            // Data payload — available to Flutter app via message.data
            data: messageData,
            tokens: tokens,
            android: {
                priority: 'high',
                notification: {
                    title: String(payload.title),
                    body: String(payload.body),
                    // Use custom sound channel for seller alerts, default otherwise
                    // The channel must be pre-created in Flutter with the matching sound
                    channelId: payload.sound ? `wasgromart_${payload.sound}` : 'wasgromart_notifications',
                    sound: payload.sound ? `${payload.sound}.mp3` : 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                },
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: String(payload.title),
                            body: String(payload.body),
                        },
                        // iOS: sound file must be bundled in the Flutter app
                        sound: payload.sound ? `${payload.sound}.mp3` : 'default',
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
