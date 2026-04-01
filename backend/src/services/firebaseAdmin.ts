import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let isFirebaseInitialized = false;

try {
    let serviceAccount: any;

    // 1. Try config file from path (Priority)
    const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountPath = envPath
        ? path.resolve(process.cwd(), envPath)
        : path.resolve(__dirname, '../../config/firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
        try {
            serviceAccount = require(serviceAccountPath);
            console.log('Firebase Admin initialized with service account file:', serviceAccountPath);
        } catch (err) {
            console.warn('Failed to parse service account file:', err);
        }
    }

    // 2. Fallback to Environment Variable
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT environment variable');
        } catch (err) {
            console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', err);
        }
    }

    // 3. Initialize if credentials found
    if (serviceAccount) {
        if (admin.apps.length === 0) {
            try {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                isFirebaseInitialized = true;
                console.log('✅ Firebase Admin SDK initialized successfully');
            } catch (initErr) {
                console.error('❌ Failed to initialize admin SDK:', initErr);
            }
        } else {
            isFirebaseInitialized = true;
        }
    } else {
        console.warn('⚠️ Firebase service account not found. Push notifications are disabled.');
    }

} catch (error) {
    console.error('CRITICAL: Error during Firebase initialization logic:', error);
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: { [key: string]: string };
}

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
        const message: any = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
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
        console.log(`[${new Date().toISOString()}] FCM Send to ${tokens.length} tokens: ${response.successCount} success, ${response.failureCount} failure`);

        return response;
    } catch (error) {
        console.error('Error sending push notification:', error);
        throw error;
    }
}
