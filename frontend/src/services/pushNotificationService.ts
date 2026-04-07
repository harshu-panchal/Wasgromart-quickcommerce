import { messaging, getToken, onMessage } from '../firebase';
import api from './api/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'dummy-vapid-key';
const LOCAL_FCM_TOKEN_KEY = 'fcm_token_web';
const TOKEN_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let tokenSyncIntervalId: number | null = null;
let visibilitySyncHandler: (() => void) | null = null;
let isTokenSyncInProgress = false;
let foregroundUnsubscribe: (() => void) | null = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Workers are not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    await navigator.serviceWorker.ready;
    await registration.update();

    const activeWorker = registration.active || registration.waiting || registration.installing;
    if (!activeWorker) {
      console.warn('[FCM] Service worker registered but no active worker is available yet.');
    }

    console.log('[FCM] Service Worker ready:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[FCM] Service Worker registration failed:', error);
    return null;
  }
}

function isNotificationPermissionGranted() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

function extractNotificationContent(payload: any) {
  const data = payload?.data || {};
  return {
    title: data.title || payload?.notification?.title || 'Kosil Notification',
    body: data.body || payload?.notification?.body || '',
    tag: data.type || 'kosil-general',
    data,
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[FCM] Notification API is not supported in this browser.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[FCM] Notification permission is denied. Skipping token request.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[FCM] Notification permission granted');
      return true;
    }

    console.warn(`[FCM] Notification permission not granted: ${permission}`);
    return false;
  } catch (error) {
    console.error('[FCM] Failed to request notification permission:', error);
    return false;
  }
}

export async function getFCMToken() {
  if (!messaging) return null;

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return null;
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return null;
    }

    await navigator.serviceWorker.ready;

    if (!window.isSecureContext) {
      console.warn('[FCM] Secure context is required for token generation.');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('[FCM] Token obtained successfully');
      return token;
    }

    console.warn('[FCM] No FCM token returned by getToken');
    return null;
  } catch (error: any) {
    console.error('[FCM] Error getting token:', error);
    if (
      error?.code === 'messaging/token-subscribe-failed' ||
      error?.message?.includes('Missing required authentication credential')
    ) {
      console.error(
        `[FCM] Potential fix: check Google Cloud Console API key restrictions. Ensure "${window.location.origin}" is allowed in HTTP referrers.`
      );
    }
    return null;
  }
}

export async function registerFCMToken(forceUpdate = false) {
  if (!messaging) {
    console.warn('[FCM] Cannot register token: Messaging is not supported or initialized.');
    return null;
  }

  try {
    const savedToken = localStorage.getItem(LOCAL_FCM_TOKEN_KEY);
    if (savedToken && !forceUpdate) {
      console.log('[FCM] Token already cached locally; skipping backend sync');
      return savedToken;
    }

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[FCM] Notification permission not granted, skipping token registration');
      return null;
    }

    const token = await getFCMToken();
    if (!token) {
      console.warn('[FCM] Failed to get token; backend registration skipped');
      return null;
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const platform = isMobile ? 'mobile' : 'web';

    try {
      console.log(`[FCM] Syncing token to backend for platform=${platform}`);
      const response = await api.post('/fcm-tokens/save', {
        token,
        platform,
      });

      if (response.data.success) {
        localStorage.setItem(LOCAL_FCM_TOKEN_KEY, token);
        console.log(`[FCM] Token synced successfully for platform=${platform}`);
        return token;
      }
    } catch (apiError: any) {
      console.error('[FCM] Backend token sync failed:', apiError?.response?.data || apiError?.message || apiError);
    }

    return token;
  } catch (error) {
    console.error('[FCM] Error in register token flow:', error);
    return null;
  }
}

async function refreshAndSyncToken(reason: string) {
  if (isTokenSyncInProgress) return;
  if (!messaging) return;
  if (!isNotificationPermissionGranted()) return;

  isTokenSyncInProgress = true;
  try {
    const currentToken = await getFCMToken();
    if (!currentToken) return;

    const savedToken = localStorage.getItem(LOCAL_FCM_TOKEN_KEY);
    const tokenChanged = savedToken !== currentToken;

    if (tokenChanged) {
      console.log(`[FCM] Token refresh detected (${reason}); syncing new token`);
      await registerFCMToken(true);
    }
  } catch (error) {
    console.error(`[FCM] Token refresh sync failed (${reason}):`, error);
  } finally {
    isTokenSyncInProgress = false;
  }
}

export function startFCMTokenRefreshSync() {
  if (!messaging) return;
  if (tokenSyncIntervalId !== null) return;

  visibilitySyncHandler = () => {
    if (document.visibilityState === 'visible') {
      void refreshAndSyncToken('visibility-change');
    }
  };

  document.addEventListener('visibilitychange', visibilitySyncHandler);
  window.addEventListener('focus', visibilitySyncHandler);

  tokenSyncIntervalId = window.setInterval(() => {
    void refreshAndSyncToken('interval');
  }, TOKEN_SYNC_INTERVAL_MS);

  void refreshAndSyncToken('startup');
}

export function stopFCMTokenRefreshSync() {
  if (tokenSyncIntervalId !== null) {
    window.clearInterval(tokenSyncIntervalId);
    tokenSyncIntervalId = null;
  }

  if (visibilitySyncHandler) {
    document.removeEventListener('visibilitychange', visibilitySyncHandler);
    window.removeEventListener('focus', visibilitySyncHandler);
    visibilitySyncHandler = null;
  }
}

export async function removeFCMTokenFromBackend() {
  const savedToken = localStorage.getItem(LOCAL_FCM_TOKEN_KEY);
  if (!savedToken) return;

  try {
    await api.delete('/fcm-tokens/remove', {
      data: {
        token: savedToken,
        platform: 'web',
      },
    });
  } catch (error) {
    console.warn('[FCM] Failed to remove token from backend during cleanup:', error);
  } finally {
    localStorage.removeItem(LOCAL_FCM_TOKEN_KEY);
  }
}

export function clearCachedFCMToken() {
  localStorage.removeItem(LOCAL_FCM_TOKEN_KEY);
}

export function hasNotificationPermission() {
  return isNotificationPermissionGranted();
}

export function setupForegroundNotificationHandler(handler?: (payload: any) => void) {
  if (!messaging) return;

  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }

  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);

    if (handler) {
      handler(payload);
    }

    if (!isNotificationPermissionGranted()) {
      return;
    }

    const { title, body, tag, data } = extractNotificationContent(payload);
    const notificationOptions = {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag,
      data,
    };

    try {
      new Notification(title, notificationOptions);
    } catch (err) {
      console.warn('[FCM] new Notification() failed; trying service worker notification:', err);
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, notificationOptions))
        .catch((swError) => {
          console.error('[FCM] Failed to show foreground notification via service worker:', swError);
        });
    }
  });
}

export function cleanupForegroundNotificationHandler() {
  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }
}

export async function initializePushNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    console.warn('[FCM] Push notifications are not supported in this browser environment.');
    return;
  }

  if (!window.isSecureContext) {
    console.error(
      '[FCM] Push notifications require a secure context (HTTPS or localhost). If testing on mobile over IP, use a secure tunnel or staging domain.'
    );
    return;
  }

  try {
    await registerServiceWorker();
  } catch (error) {
    console.error('[FCM] Error initializing push notifications:', error);
  }
}
