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
        console.log('[firebase-messaging-sw.js] Background message received:', payload);

        const data = payload?.data || {};
        const notification = payload?.notification || {};

        // Prefer data fields (sent by backend) over notification block
        const notificationTitle = data.title || notification.title || 'New Order arrived';
        const notificationBody  = data.body  || notification.body  || data.msg || data.message || '';

        const isDeliveryAlert = data.type === 'NEW_ORDER' || data.type === 'ORDER_ASSIGNED';

        const notificationOptions = {
            body: notificationBody,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: data.type || 'wasgromart-general',
            data: data,
            // Keep delivery alerts on screen until the driver taps them
            requireInteraction: isDeliveryAlert,
            // Use vibration pattern for urgency on delivery alerts
            vibrate: isDeliveryAlert ? [200, 100, 200, 100, 200] : [100],
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
