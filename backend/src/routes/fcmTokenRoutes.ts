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

function dedupeTokens(tokens: string[] = []) {
  return [...new Set(tokens.map((token) => token?.trim()).filter(Boolean))];
}

function normalizeUserTokens(user: any) {
  user.fcmTokens = dedupeTokens(user.fcmTokens || []).slice(-10);
  user.fcmTokenMobile = dedupeTokens(user.fcmTokenMobile || []).slice(-10);
}

async function resolveAuthenticatedUser(userId: string, userType?: string) {
  if (userType === 'Delivery') return Delivery.findById(userId);
  if (userType === 'Admin') return Admin.findById(userId);
  if (userType === 'Seller') return Seller.findById(userId);
  return Customer.findById(userId);
}

async function removeInvalidTokensFromUser(user: any, invalidTokens: string[] = []) {
  if (!user || invalidTokens.length === 0) return;

  const invalidSet = new Set(invalidTokens);
  const beforeWeb = user.fcmTokens?.length || 0;
  const beforeMobile = user.fcmTokenMobile?.length || 0;

  user.fcmTokens = (user.fcmTokens || []).filter((token: string) => !invalidSet.has(token));
  user.fcmTokenMobile = (user.fcmTokenMobile || []).filter((token: string) => !invalidSet.has(token));
  normalizeUserTokens(user);

  const removedCount =
    (beforeWeb - (user.fcmTokens?.length || 0)) +
    (beforeMobile - (user.fcmTokenMobile?.length || 0));

  if (removedCount > 0) {
    await user.save();
    console.log(`[${new Date().toISOString()}] Removed ${removedCount} invalid FCM token(s) for user ${user._id}`);
  }
}

async function detachTokenFromOtherUsers(token: string, currentUserId: string, currentUserType?: string) {
  const update = { $pull: { fcmTokens: token, fcmTokenMobile: token } };

  const operations: Array<Promise<any>> = [];
  if (currentUserType !== 'Customer') {
    operations.push(Customer.updateMany({ _id: { $ne: currentUserId } }, update));
  } else {
    operations.push(Customer.updateMany({ _id: { $ne: currentUserId } }, update));
  }
  if (currentUserType !== 'Delivery') {
    operations.push(Delivery.updateMany({ _id: { $ne: currentUserId } }, update));
  } else {
    operations.push(Delivery.updateMany({ _id: { $ne: currentUserId } }, update));
  }
  if (currentUserType !== 'Admin') {
    operations.push(Admin.updateMany({ _id: { $ne: currentUserId } }, update));
  } else {
    operations.push(Admin.updateMany({ _id: { $ne: currentUserId } }, update));
  }
  if (currentUserType !== 'Seller') {
    operations.push(Seller.updateMany({ _id: { $ne: currentUserId } }, update));
  } else {
    operations.push(Seller.updateMany({ _id: { $ne: currentUserId } }, update));
  }

  await Promise.all(operations);
}

/**
 * @route   POST /api/v1/fcm-tokens/save
 * @desc    Save FCM token for authenticated user
 * @access  Private
 */
router.post('/save', authenticate, async (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Received FCM /save request`);
  console.log(`[${timestamp}] User: ${req.user?.userId} (${req.user?.userType})`);
  console.log(`[${timestamp}] Body:`, JSON.stringify(req.body, null, 2));

  try {
    const { platform = 'web' } = req.body;
    const rawToken = req.body.token || req.body.fcmToken || req.body.registrationToken;
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

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
    const user: any = await resolveAuthenticatedUser(userId, userType);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    normalizeUserTokens(user);
    await detachTokenFromOtherUsers(token, userId, userType);

    const isWebPlatform = platform !== 'mobile';
    const currentTokenList = isWebPlatform ? (user.fcmTokens || []) : (user.fcmTokenMobile || []);
    const isNewToken = !currentTokenList.includes(token);

    // Ensure token does not exist in both arrays and keep current platform as source of truth.
    user.fcmTokens = (user.fcmTokens || []).filter((t: string) => t !== token);
    user.fcmTokenMobile = (user.fcmTokenMobile || []).filter((t: string) => t !== token);

    if (isWebPlatform) {
      user.fcmTokens = [...(user.fcmTokens || []), token];
    } else {
      user.fcmTokenMobile = [...(user.fcmTokenMobile || []), token];
    }

    normalizeUserTokens(user);
    await user.save();

    const now = Date.now();
    const lastNotified = recentlyNotifiedTokens.get(token) || 0;
    const cooldownMs = 300000; // 5 minute cooldown

    if (isNewToken && now - lastNotified > cooldownMs) {
      recentlyNotifiedTokens.set(token, now);
      try {
        const pushResponse: any = await sendPushNotification([token], {
          title: 'Login Successful',
          body: 'Welcome back to Kosil! You have successfully logged in.',
          data: {
            type: 'login_success',
            link: '/',
            timestamp: new Date().toISOString(),
          },
        });

        await removeInvalidTokensFromUser(user, pushResponse?.invalidTokens || []);

        console.log(
          `[${new Date().toISOString()}] Login notification sent to NEW token: ${token.substring(0, 10)}...`
        );

        if (recentlyNotifiedTokens.size > 1000) {
          const expiry = Date.now() - cooldownMs * 5;
          for (const [cachedToken, time] of recentlyNotifiedTokens.entries()) {
            if (time < expiry) recentlyNotifiedTokens.delete(cachedToken);
          }
        }
      } catch (pushError) {
        console.error('Failed to send login notification:', pushError);
      }
    } else {
      if (!isNewToken) {
        console.log(`[${new Date().toISOString()}] Notification suppressed: Token already registered (re-registration)`);
      } else {
        console.log(
          `[${new Date().toISOString()}] Notification suppressed: Cooldown active (last sent ${Math.round((now - lastNotified) / 1000)}s ago)`
        );
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
    const { platform = 'web' } = req.body;
    const rawToken = req.body.token;
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

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
    const user: any = await resolveAuthenticatedUser(userId, userType);

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

    normalizeUserTokens(user);
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
    const user: any = await resolveAuthenticatedUser(userId, userType);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const tokens = [...(user.fcmTokens || []), ...(user.fcmTokenMobile || [])];
    const uniqueTokens = dedupeTokens(tokens);

    if (uniqueTokens.length === 0) {
      res.json({ success: false, message: 'No FCM tokens found for this user. Please register a token first.' });
      return;
    }

    const response: any = await sendPushNotification(uniqueTokens as string[], {
      title: 'Test Notification',
      body: 'This is a test notification from Kosil Backend',
      data: {
        type: 'test',
        link: '/',
        timestamp: new Date().toISOString(),
      },
    });

    await removeInvalidTokensFromUser(user, response?.invalidTokens || []);

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

    const defaultTitle = platform === 'mobile' ? 'Mobile Test Notification' : 'Web Test Notification';
    const defaultBody =
      platform === 'mobile'
        ? 'This notification confirms your Mobile App FCM setup is working!'
        : 'This notification confirms your Web App FCM setup is working!';

    const response = await sendPushNotification([token], {
      title: title || defaultTitle,
      body: body || defaultBody,
      data: data || { type: 'test_direct', platform: platform || 'unknown' },
    });

    res.json({
      success: true,
      message: 'Notification sent',
      details: {
        sentTo: token,
        platform: platform || 'detected-as-generic',
        firebaseResponse: response,
      },
    });
  } catch (error: any) {
    console.error('Direct notification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
