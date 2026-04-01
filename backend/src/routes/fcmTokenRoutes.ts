import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import Customer from '../models/Customer';
import Delivery from '../models/Delivery';
import Admin from '../models/Admin';
import Seller from '../models/Seller';
import { sendPushNotification } from '../services/firebaseAdmin';

const router = express.Router();

// In-memory cache to prevent duplicate notifications within a short window (cooldown)
const recentlyNotifiedTokens = new Map<string, number>();

/**
 * @route   POST /api/v1/fcm-tokens/save
 * @desc    Save FCM token for authenticated user
 * @access  Private
 */
router.post('/save', authenticate, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📥 Received FCM /save request`);
    console.log(`[${timestamp}] User: ${req.user?.userId} (${req.user?.userType})`);
    console.log(`[${timestamp}] Body:`, JSON.stringify(req.body, null, 2));

    try {
        const { platform = 'web' } = req.body;
        const token = req.body.token || req.body.fcmToken || req.body.registrationToken;

        if (!token) {
            console.warn(`[${new Date().toISOString()}] FCM POST /save - Missing token in body`);
            res.status(400).json({ success: false, message: 'Token is required' });
            return;
        }

        if (!req.user || !req.user.userId) {
            res.status(401).json({ success: false, message: 'User authentication required' });
            return;
        }
        const userId = req.user.userId;
        const userType = req.user.userType;

        // Determine which model to use
        let user: any;
        if (userType === 'Delivery') {
            user = await Delivery.findById(userId);
        } else if (userType === 'Admin') {
            user = await Admin.findById(userId);
        } else if (userType === 'Seller') {
            user = await Seller.findById(userId);
        } else {
            // Default to Customer for 'Customer' type or fallback
            user = await Customer.findById(userId);
        }

        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        if (platform === 'web') {
            if (!user.fcmTokens) user.fcmTokens = [];
            if (!user.fcmTokens.includes(token)) {
                user.fcmTokens.push(token);
                // Limit to 10 tokens per user per platform to prevent unlimited growth
                if (user.fcmTokens.length > 10) {
                    user.fcmTokens = user.fcmTokens.slice(-10);
                }
            }
        } else if (platform === 'mobile') {
            if (!user.fcmTokenMobile) user.fcmTokenMobile = [];
            if (!user.fcmTokenMobile.includes(token)) {
                user.fcmTokenMobile.push(token);
                if (user.fcmTokenMobile.length > 10) {
                    user.fcmTokenMobile = user.fcmTokenMobile.slice(-10);
                }
            }
        }

        // Check if this is a NEW token (not a re-registration)
        const isNewToken = platform === 'web'
            ? !user.fcmTokens?.includes(token)
            : !user.fcmTokenMobile?.includes(token);

        await user.save();

        // Check cooldown to prevent duplicate notifications during rapid re-registrations
        const now = Date.now();
        const lastNotified = recentlyNotifiedTokens.get(token) || 0;
        const cooldownMs = 300000; // 5 minutes cooldown (increased from 1 minute)

        // Only send notification for NEW tokens that haven't been notified recently
        if (isNewToken && (now - lastNotified > cooldownMs)) {
            recentlyNotifiedTokens.set(token, now);
            try {
                await sendPushNotification([token], {
                    title: 'Login Successful',
                    body: 'Welcome back to Kosil! You have successfully logged in.',
                    data: {
                        type: 'login_success',
                        link: '/',
                        timestamp: new Date().toISOString()
                    }
                });
                console.log(`[${new Date().toISOString()}] Login notification sent to NEW token: ${token.substring(0, 10)}...`);

                // Cleanup map occasionally to prevent memory leaks
                if (recentlyNotifiedTokens.size > 1000) {
                    const expiry = Date.now() - (cooldownMs * 5);
                    for (const [t, time] of recentlyNotifiedTokens.entries()) {
                        if (time < expiry) recentlyNotifiedTokens.delete(t);
                    }
                }
            } catch (pushError) {
                console.error('Failed to send login notification:', pushError);
            }
        } else {
            if (!isNewToken) {
                console.log(`[${new Date().toISOString()}] Notification suppressed: Token already registered (re-registration)`);
            } else {
                console.log(`[${new Date().toISOString()}] Notification suppressed: Cooldown active (last sent ${Math.round((now - lastNotified) / 1000)}s ago)`);
            }
        }

        res.json({ success: true, message: 'FCM token saved' });
    } catch (error: any) {
        console.error('Error saving FCM token:', error);
        res.status(500).json({ success: false, message: 'Failed to save token', error: error.message });
    }
});

/**
 * @route   DELETE /api/v1/fcm-tokens/remove
 * @desc    Remove FCM token
 * @access  Private
 */
router.delete('/remove', authenticate, async (req: Request, res: Response) => {
    try {
        const { token, platform = 'web' } = req.body;

        if (!token) {
            res.status(400).json({ success: false, message: 'Token is required' });
            return;
        }

        if (!req.user || !req.user.userId) {
            res.status(401).json({ success: false, message: 'User authentication required' });
            return;
        }
        const userId = req.user.userId;
        const userType = req.user.userType;

        let user: any;
        if (userType === 'Delivery') {
            user = await Delivery.findById(userId);
        } else if (userType === 'Admin') {
            user = await Admin.findById(userId);
        } else if (userType === 'Seller') {
            user = await Seller.findById(userId);
        } else {
            user = await Customer.findById(userId);
        }

        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        if (platform === 'web') {
            if (user.fcmTokens) {
                user.fcmTokens = user.fcmTokens.filter((t: string) => t !== token);
            }
        } else if (platform === 'mobile') {
            if (user.fcmTokenMobile) {
                user.fcmTokenMobile = user.fcmTokenMobile.filter((t: string) => t !== token);
            }
        }

        await user.save();
        res.json({ success: true, message: 'FCM token removed' });
    } catch (error: any) {
        console.error('Error removing FCM token:', error);
        res.status(500).json({ success: false, message: 'Failed to remove token', error: error.message });
    }
});

/**
 * @route   POST /api/v1/fcm-tokens/test
 * @desc    Send a test notification to the authenticated user
 * @access  Private
 */
router.post('/test', authenticate, async (req: Request, res: Response) => {
    try {
        if (!req.user || !req.user.userId) {
            res.status(401).json({ success: false, message: 'User authentication required' });
            return;
        }
        const userId = req.user.userId;
        const userType = req.user.userType;

        let user: any;
        if (userType === 'Delivery') {
            user = await Delivery.findById(userId);
        } else if (userType === 'Admin') {
            user = await Admin.findById(userId);
        } else if (userType === 'Seller') {
            user = await Seller.findById(userId);
        } else {
            user = await Customer.findById(userId);
        }

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const tokens = [...(user.fcmTokens || []), ...(user.fcmTokenMobile || [])];
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            res.json({ success: false, message: 'No FCM tokens found for this user. Please register a token first.' });
            return;
        }

        const response = await sendPushNotification(uniqueTokens as string[], {
            title: 'Test Notification',
            body: 'This is a test notification from Kosil Backend',
            data: {
                type: 'test',
                link: '/',
                timestamp: new Date().toISOString()
            }
        });

        res.json({ success: true, message: 'Test notification process completed', details: response });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/v1/fcm-tokens/send-direct
 * @desc    Send a notification directly to a provided FCM token (Useful for Postman testing)
 * @access  Public (Dev only)
 */
router.post('/send-direct', async (req: Request, res: Response) => {
    try {
        const { token, platform, title, body, data } = req.body;

        if (!token) {
            res.status(400).json({ success: false, message: 'FCM Token is required' });
            return;
        }

        console.log(`Sending direct test notification to: ${token} (Platform: ${platform || 'unknown'})`);

        // Defaults based on platform
        const defaultTitle = platform === 'mobile' ? 'Mobile Test Notification' : 'Web Test Notification';
        const defaultBody = platform === 'mobile'
            ? 'This notification confirms your Mobile App FCM setup is working!'
            : 'This notification confirms your Web App FCM setup is working!';

        const response = await sendPushNotification([token], {
            title: title || defaultTitle,
            body: body || defaultBody,
            data: data || { type: 'test_direct', platform: platform || 'unknown' }
        });

        res.json({
            success: true,
            message: 'Notification sent',
            details: {
                sentTo: token,
                platform: platform || 'detected-as-generic',
                firebaseResponse: response
            }
        });
    } catch (error: any) {
        console.error('Direct notification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
