import { messaging, getToken, onMessage } from '../firebase';
import api from './api/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'dummy-vapid-key';
const LOCAL_FCM_TOKEN_KEY = 'fcm_token_web';
const LOCAL_FCM_TOKEN_MOBILE_KEY = 'fcm_token_mobile';
const TOKEN_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let tokenSyncIntervalId: number | null = null;
let visibilitySyncHandler: (() => void) | null = null;
let isTokenSyncInProgress = false;
let foregroundUnsubscribe: (() => void) | null = null;

// Cache SW registration so we never register more than once
let swRegistration: ServiceWorkerRegistration | null = null;
let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

// ─── Flutter Bridge ───────────────────────────────────────────────────────────

/**
 * Exposes window.onFlutterFCMToken(token) for Flutter WebView to call.
 * Flutter gets the native FCM token and passes it here → saved as platform='mobile'.
 */
export function setupFlutterFCMBridge() {
  (window as any).onFlutterFCMToken = async (token: string) => {
    if (!token) return;
    console.log('[FCM] Received native FCM token from Flutter bridge');

    const cached = localStorage.getItem(LOCAL_FCM_TOKEN_MOBILE_KEY);
    if (cached === token) {
      console.log('[FCM] Flutter token unchanged, skipping sync');
      return;
    }

    try {
      const response = await api.post('/fcm-tokens/save', { token, platform: 'mobile' });
      if (response.data.success) {
        localStorage.setItem(LOCAL_FCM_TOKEN_MOBILE_KEY, token);
        console.log('[FCM] Flutter native token saved to backend successfully');
      }
    } catch (err: any) {
      console.error('[FCM] Failed to save Flutter token:', err?.response?.data || err?.message);
    }
  };
  console.log('[FCM] Flutter bridge ready: window.onFlutterFCMToken');
}

// ─── Service Worker ───────────────────────────────────────────────────────────

/** Register SW once and cache the result. Subsequent calls return the cached registration. */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;

  // If already in progress, wait for it instead of starting a new one
  if (swRegistrationPromise) return swRegistrationPromise;

  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Workers are not supported');
    return null;
  }

  swRegistrationPromise = (async () => {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;
      swRegistration = registration;
      console.log('[FCM] Service Worker ready:', registration.scope);
      return registration;
    } catch (error) {
      console.error('[FCM] Service Worker registration failed:', error);
      swRegistrationPromise = null; // allow retry on next call
      return null;
    }
  })();

  return swRegistrationPromise;
}

// ─── Permission ───────────────────────────────────────────────────────────────

function isNotificationPermissionGranted() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[FCM] Notification API not supported.');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    console.warn('[FCM] Notification permission denied.');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[FCM] Notification permission granted');
      return true;
    }
    console.warn(`[FCM] Permission not granted: ${permission}`);
    return false;
  } catch (error) {
    console.error('[FCM] Failed to request permission:', error);
    return false;
  }
}

// ─── Token ────────────────────────────────────────────────────────────────────

export async function getFCMToken(): Promise<string | null> {
  if (!messaging) return null;

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return null;

    const registration = await getServiceWorkerRegistration();
    if (!registration) return null;

    if (!window.isSecureContext) {
      console.warn('[FCM] Secure context required for token generation.');
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

    console.warn('[FCM] No token returned by getToken');
    return null;
  } catch (error: any) {
    console.error('[FCM] Error getting token:', error);
    if (
      error?.code === 'messaging/token-subscribe-failed' ||
      error?.message?.includes('Missing required authentication credential')
    ) {
      console.error(
        `[FCM] Check Google Cloud Console API key restrictions — ensure "${window.location.origin}" is allowed.`
      );
    }
    return null;
  }
}

export async function registerFCMToken(forceUpdate = false): Promise<string | null> {
  if (!messaging) {
    console.warn('[FCM] Messaging not supported or initialized.');
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
      console.warn('[FCM] Permission not granted, skipping registration');
      return null;
    }

    const token = await getFCMToken();
    if (!token) {
      console.warn('[FCM] Failed to get token; backend registration skipped');
      return null;
    }

    // Use 'mobile' platform for mobile browsers so tokens go to fcmTokenMobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const platform = isMobile ? 'mobile' : 'web';

    try {
      console.log(`[FCM] Syncing token to backend for platform=${platform}`);
      const response = await api.post('/fcm-tokens/save', { token, platform });
      if (response.data.success) {
        localStorage.setItem(LOCAL_FCM_TOKEN_KEY, token);
        console.log(`[FCM] Token synced successfully for platform=${platform}`);
        return token;
      }
    } catch (apiError: any) {
      console.error('[FCM] Backend token sync failed:', apiError?.response?.data || apiError?.message);
    }

    return token;
  } catch (error) {
    console.error('[FCM] Error in register token flow:', error);
    return null;
  }
}

// ─── Token Refresh Sync ───────────────────────────────────────────────────────

async function refreshAndSyncToken(reason: string) {
  if (isTokenSyncInProgress) return;
  if (!messaging) return;
  if (!isNotificationPermissionGranted()) return;

  isTokenSyncInProgress = true;
  try {
    const currentToken = await getFCMToken();
    if (!currentToken) return;

    const savedToken = localStorage.getItem(LOCAL_FCM_TOKEN_KEY);
    if (savedToken !== currentToken) {
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
  if (tokenSyncIntervalId !== null) return; // already running

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

// ─── Token Removal ────────────────────────────────────────────────────────────

export async function removeFCMTokenFromBackend() {
  const savedToken = localStorage.getItem(LOCAL_FCM_TOKEN_KEY);
  if (!savedToken) return;
  try {
    await api.delete('/fcm-tokens/remove', {
      data: { token: savedToken, platform: 'web' },
    });
  } catch (error) {
    console.warn('[FCM] Failed to remove token from backend:', error);
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

// ─── Foreground Handler ───────────────────────────────────────────────────────

function extractNotificationContent(payload: any) {
  const data = payload?.data || {};
  return {
    title: data.title || payload?.notification?.title || 'WasgroMart',
    body: data.body || payload?.notification?.body || '',
    tag: data.type || 'wasgromart-general',
    data,
  };
}

export function setupForegroundNotificationHandler(handler?: (payload: any) => void) {
  if (!messaging) return;

  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }

  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    if (handler) handler(payload);
    if (!isNotificationPermissionGranted()) return;

    const { title, body, tag, data } = extractNotificationContent(payload);
    const options = { body, icon: '/favicon.ico', badge: '/favicon.ico', tag, data };

    try {
      new Notification(title, options);
    } catch {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch((err) => console.error('[FCM] Failed to show foreground notification:', err));
    }
  });
}

export function cleanupForegroundNotificationHandler() {
  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initializePushNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    console.warn('[FCM] Push notifications not supported in this environment.');
    return;
  }
  if (!window.isSecureContext) {
    console.error('[FCM] Push notifications require HTTPS.');
    return;
  }
  // Pre-register SW so it's ready when getFCMToken is called
  await getServiceWorkerRegistration();
}
