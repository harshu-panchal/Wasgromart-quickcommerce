import { initializeApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getAnalytics, Analytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let messaging: Messaging | null = null;

try {
    // Only initialize if we have the minimum required config
    if (firebaseConfig.projectId && firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        analytics = getAnalytics(app);

        try {
            messaging = getMessaging(app);
        } catch (error: any) {
            console.warn('Firebase Messaging not supported in this environment.', error);
        }
    } else {
        console.warn('Firebase configuration missing. App features dependent on Firebase will be disabled.');
    }
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

export { messaging, getToken, onMessage };
export default app;
