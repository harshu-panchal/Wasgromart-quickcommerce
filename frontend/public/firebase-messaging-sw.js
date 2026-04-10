// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// ⚠️ MUST match the Firebase project used in src/firebase.ts (appzeto-quick-commerce)
const firebaseConfig = {
    apiKey: "AIzaSyBqT8QRQJuljNV1W5-XGK-plhSwLzwUJW4",
    authDomain: "appzeto-quick-commerce.firebaseapp.com",
    projectId: "appzeto-quick-commerce",
    storageBucket: "appzeto-quick-commerce.firebasestorage.app",
    messagingSenderId: "477007016819",
    appId: "1:477007016819:web:cc5fafe34a8b25b24a8b06",
    measurementId: "G-NKHFJRKT0Z"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize messaging
let messaging;
try {
    messaging = firebase.messaging();
} catch (err) {
    console.error('Failed to initialize messaging in SW:', err);
}

if (messaging) {
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        const data = payload?.data || {};
        const notificationTitle = data.title || payload.notification?.title || 'New Message';
        const notificationOptions = {
            body: data.body || payload.notification?.body || '',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: data.type || 'kosil-general',
            data: data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    const urlToOpen = data?.link || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there is already a window/tab open with the target URL
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no window/tab is open, open the URL
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
