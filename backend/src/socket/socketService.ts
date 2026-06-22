import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../services/jwtService';
import { handleOrderAcceptance, handleOrderRejection, getActiveNotificationsForDeliveryBoy } from '../services/orderNotificationService';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import DeliveryTracking from '../models/DeliveryTracking';
import mongoose from 'mongoose';
import { createSupportMessage } from '../modules/chat/services/supportChatService';
import { logger } from '../utils/logger';
import { hostingDefaults, isSharedHosting } from '../config/hosting';

// In-memory cache for order destinations (lat, lng) to avoid DB reads on every update
// Key: orderId, Value: { latitude, longitude, lastAccess }
const orderDestinationsCache = new Map<string, { latitude: number; longitude: number; lastAccess: number }>();

// Throttler for DB updates
// Key: orderId, Value: last timestamp
const locationUpdateThrottler = new Map<string, number>();

// TTL after which idle entries are evicted (no location update for this long).
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Single periodic sweep prunes both maps. This replaces the previous pattern of
// scheduling one setTimeout PER order (which retained a timer + closure for every
// order ever tracked) and the throttler map that was only cleared on status change.
const cacheSweep = setInterval(() => {
    const now = Date.now();
    for (const [orderId, dest] of orderDestinationsCache.entries()) {
        if (now - dest.lastAccess > CACHE_TTL_MS) {
            orderDestinationsCache.delete(orderId);
        }
    }
    for (const [orderId, ts] of locationUpdateThrottler.entries()) {
        if (now - ts > CACHE_TTL_MS) {
            locationUpdateThrottler.delete(orderId);
        }
    }
}, 10 * 60 * 1000); // every 10 minutes
// Do not keep the event loop alive solely for this timer (clean shutdown).
cacheSweep.unref();

// Haversine formula to calculate distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// Calculate ETA (assuming 30 km/h)
const calculateETA = (distanceInMeters: number): number => {
    const averageSpeedKmh = 30;
    const averageSpeedMs = (averageSpeedKmh * 1000) / 60; // meters per minute
    return Math.ceil(distanceInMeters / averageSpeedMs);
};

export const initializeSocket = (httpServer: HttpServer) => {
    // Shared-hosting reverse proxies often drop idle WebSocket connections around
    // 60s. Keepalive pings a bit more aggressive; disable per-message deflate to
    // save CPU on a single shared core.
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or server-to-server)
                if (!origin) return callback(null, true);

                // In production, check against allowed origins
                if (process.env.NODE_ENV === 'production') {
                    // Get allowed origins from environment variable (comma-separated)
                    const frontendUrl = process.env.FRONTEND_URL || "";
                    const allowedOrigins = frontendUrl
                        .split(",")
                        .map((url) => url.trim())
                        .filter((url) => url.length > 0);

                    // Default production origins if FRONTEND_URL not set
                    const defaultOrigins = [
                        "https://www.wasgromart.com",
                        "https://wasgromart.com",
                        "https://wasgromart-frontend.onrender.com",
                    ];

                    const allAllowedOrigins = allowedOrigins.length > 0
                        ? [...allowedOrigins, ...defaultOrigins]
                        : defaultOrigins;

                    // Normalize origins for comparison (remove trailing slash, lowercase)
                    const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
                    const normalizedOrigin = normalizeUrl(origin);

                    // Check if origin matches any allowed origin
                    const isAllowed = allAllowedOrigins.some((allowedOrigin) => {
                        const normalizedAllowed = normalizeUrl(allowedOrigin);

                        // Exact match
                        if (normalizedOrigin === normalizedAllowed) return true;

                        // Support for www and non-www variants
                        if (normalizedAllowed.includes("www.")) {
                            const nonWww = normalizedAllowed.replace("www.", "");
                            if (normalizedOrigin === nonWww) return true;
                        } else {
                            const withWww = normalizedAllowed.replace(/^(https?:\/\/)/, "$1www.");
                            if (normalizedOrigin === withWww) return true;
                        }
                        return false;
                    });

                    if (!isAllowed) {
                        console.warn(`⚠️ Socket.io connection rejected from origin: ${origin}. Allowed origins: ${allAllowedOrigins.join(', ')}`);
                        console.warn(`⚠️ Normalized origin: ${normalizedOrigin}`);
                    } else {
                        logger.debug(`✅ Socket.io connection allowed from origin: ${origin}`);
                    }

                    return callback(null, isAllowed);
                }

                // In development, allow any localhost port
                if (
                    origin.startsWith('http://localhost:') ||
                    origin.startsWith('http://127.0.0.1:') ||
                    origin.startsWith('https://localhost:')
                ) {
                    return callback(null, true);
                }

                return callback(null, false);
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Production-specific Socket.io configuration
        allowEIO3: true, // Allow Engine.IO v3 clients
        pingTimeout: isSharedHosting ? 45000 : 60000,
        pingInterval: isSharedHosting ? 20000 : 25000,
        transports: ['websocket', 'polling'], // polling fallback when proxy blocks WS upgrade
        upgradeTimeout: 30000,
        perMessageDeflate: hostingDefaults.socketPerMessageDeflate,
        // Cap how many sockets one process holds (shared hosting RAM limit).
        maxHttpBufferSize: 1e6, // 1 MB
    });

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            // Allow connection but mark as unauthenticated
            logger.debug('⚠️ Socket connecting without token');
            return next();
        }

        try {
            const decoded = verifyToken(token);
            logger.debug('✅ Socket auth decoded:', decoded);
            (socket as any).user = decoded;
            next();
        } catch (error: any) {
            console.error('❌ Socket auth error:', error.message);
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        logger.debug('✅ Socket connected:', socket.id, 'User:', (socket as any).user?.userId || 'Unauthenticated');

        // Auto-join support rooms based on user type
        const socketUser = (socket as any).user;
        if (socketUser?.userType === 'Seller') {
            socket.join(`support-seller-${socketUser.userId}`);
        } else if (socketUser?.userType === 'Admin') {
            socket.join('support-admin');
        }

        // Support chat: join a specific seller room (Admin) or own room (Seller)
        socket.on('support:join', (data: { sellerId?: string }) => {
            const user = (socket as any).user;
            if (!user) {
                socket.emit('support:error', { message: 'Authentication required' });
                return;
            }

            const sellerId =
                user.userType === 'Seller' ? user.userId : data?.sellerId;

            if (!sellerId) {
                socket.emit('support:error', { message: 'Seller id is required' });
                return;
            }

            socket.join(`support-seller-${sellerId}`);
            socket.emit('support:joined', { sellerId });
        });

        // Support chat: send message
        socket.on(
            'support:message',
            async (
                data: { sellerId?: string; text?: string },
                callback?: (response: { success: boolean; message: string; data?: any }) => void
            ) => {
                const user = (socket as any).user;
                if (!user) {
                    const response = { success: false, message: 'Authentication required' };
                    if (callback) callback(response);
                    socket.emit('support:error', response);
                    return;
                }

                const senderType = user.userType === 'Seller' ? 'Seller' : 'Admin';
                const sellerId =
                    senderType === 'Seller' ? user.userId : data?.sellerId;

                if (!sellerId) {
                    const response = { success: false, message: 'Seller id is required' };
                    if (callback) callback(response);
                    socket.emit('support:error', response);
                    return;
                }

                if (!data?.text || typeof data.text !== 'string') {
                    const response = { success: false, message: 'Message text is required' };
                    if (callback) callback(response);
                    socket.emit('support:error', response);
                    return;
                }

                try {
                    const { conversation, message } = await createSupportMessage({
                        sellerId,
                        senderType,
                        senderId: user.userId,
                        text: data.text,
                    });

                    const messagePayload = {
                        id: message._id,
                        conversationId: conversation?._id,
                        sellerId,
                        senderType: message.senderType,
                        senderId: message.senderId,
                        text: message.text,
                        createdAt: message.createdAt,
                        updatedAt: message.updatedAt,
                    };

                    const conversationPayload = {
                        id: conversation?._id,
                        sellerId,
                        lastMessage: conversation?.lastMessage || message.text,
                        lastMessageAt: conversation?.lastMessageAt || message.createdAt,
                        lastMessageBy: conversation?.lastMessageBy || message.senderType,
                        unreadForAdmin: conversation?.unreadForAdmin ?? 0,
                        unreadForSeller: conversation?.unreadForSeller ?? 0,
                        isOpen: conversation?.isOpen ?? true,
                    };

                    io.to('support-admin').emit('support:conversation-update', conversationPayload);
                    io.to(`support-seller-${sellerId}`).emit('support:conversation-update', conversationPayload);
                    io.to('support-admin').emit('support:message', messagePayload);
                    io.to(`support-seller-${sellerId}`).emit('support:message', messagePayload);

                    if (callback) {
                        callback({ success: true, message: 'Message sent', data: messagePayload });
                    }
                } catch (error: any) {
                    console.error('Support chat error:', error);
                    const response = { success: false, message: error.message || 'Failed to send message' };
                    if (callback) callback(response);
                    socket.emit('support:error', response);
                }
            }
        );

        // Customer subscribes to order tracking
        socket.on('track-order', async (orderId: string) => {
            const user = (socket as any).user;

            if (!user) {
                console.warn(`⚠️ Unauthenticated socket tried to track order: ${orderId}`);
                socket.emit('tracking-error', { message: 'Authentication required' });
                return;
            }

            try {
                // Verify order belongs to this customer
                const order = await Order.findOne({ _id: orderId, customer: user.userId });

                if (!order) {
                    console.warn(`⚠️ User ${user.userId} tried to track unauthorized order: ${orderId}`);
                    socket.emit('tracking-error', { message: 'Unauthorized or order not found' });
                    return;
                }

                logger.debug(`📦 Customer ${user.userId} tracking order: ${orderId}`);
                socket.join(`order-${orderId}`);

                // Send acknowledgment
                socket.emit('tracking-started', {
                    orderId,
                    message: 'Live tracking started',
                });
            } catch (error) {
                console.error(`❌ Error in track-order for order ${orderId}:`, error);
                socket.emit('tracking-error', { message: 'Internal server error' });
            }
        });

        // Customer unsubscribes from order tracking
        socket.on('stop-tracking', (orderId: string) => {
            logger.debug(`🛑 Stopped tracking order: ${orderId}`);
            socket.leave(`order-${orderId}`);
        });

        // Delivery partner joins their active deliveries room
        socket.on('join-delivery-room', (deliveryPartnerId: string) => {
            logger.debug(`🛵 Delivery partner joined: ${deliveryPartnerId}`);
            socket.join(`delivery-${deliveryPartnerId}`);
        });

        // Seller joins their notification room
        socket.on('join-seller-room', async (sellerId: string) => {
            const normalizedSellerId = String(sellerId).trim();
            logger.debug(`🏪 Seller ${normalizedSellerId} joined notifications room`);
            socket.join(`seller-${normalizedSellerId}`);

            socket.emit('joined-seller-room', {
                success: true,
                message: 'Successfully joined seller notifications room',
                sellerId: normalizedSellerId
            });

            // Check for recent (last 15 mins) pending orders to resend missed notifications.
            // IMPORTANT: query the Order collection first (bounded by status + time +
            // limit) and only then load the matching OrderItems. The previous version
            // loaded EVERY order item this seller ever had and populated each order,
            // which under reconnect storms caused large memory/CPU spikes.
            try {
                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

                const recentOrders = await Order.find({
                    status: { $in: ['Received', 'Pending'] },
                    createdAt: { $gt: fifteenMinutesAgo },
                })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .lean();

                const orderMap = new Map();

                if (recentOrders.length > 0) {
                    const orderIds = recentOrders.map((o: any) => o._id);
                    const recentItems = await OrderItem.find({
                        seller: new mongoose.Types.ObjectId(normalizedSellerId),
                        order: { $in: orderIds },
                    }).lean();

                    const ordersById = new Map(recentOrders.map((o: any) => [o._id.toString(), o]));

                    for (const item of recentItems) {
                        const oid = (item.order as any).toString();
                        const order = ordersById.get(oid);
                        if (!order) continue;
                        if (!orderMap.has(oid)) {
                            orderMap.set(oid, { order, items: [] });
                        }
                        orderMap.get(oid).items.push(item);
                    }
                }

                for (const [orderId, data] of orderMap.entries()) {
                    const { order, items } = data;
                    const notificationData = {
                        type: 'NEW_ORDER',
                        orderId: order._id,
                        orderNumber: order.orderNumber,
                        status: order.status,
                        paymentStatus: order.paymentStatus,
                        customer: {
                            name: order.customerName,
                            email: order.customerEmail,
                            phone: order.customerPhone,
                            address: order.deliveryAddress
                        },
                        items: items.map((item: any) => ({
                            productName: item.productName,
                            quantity: item.quantity,
                            price: item.unitPrice,
                            total: item.total,
                            variation: item.variation
                        })),
                        totalAmount: items.reduce((acc: number, item: any) => acc + item.total, 0),
                        timestamp: order.createdAt
                    };
                    
                    logger.debug(`📤 Resending missed NEW_ORDER notification to seller ${normalizedSellerId} for order ${order.orderNumber}`);
                    socket.emit('seller-notification', notificationData);
                }
            } catch (err) {
                console.error('Error fetching missed orders for seller:', err);
            }
        });

        // Delivery boy joins notification room
        socket.on('join-delivery-notifications', (deliveryBoyId: string) => {
            // Normalize deliveryBoyId to string to ensure consistent room naming
            const normalizedDeliveryBoyId = String(deliveryBoyId).trim();
            logger.debug(`🔔 Delivery boy ${normalizedDeliveryBoyId} joined notifications room`);

            // Only join personal room (not general room) to prevent duplicate notifications
            socket.join(`delivery-${normalizedDeliveryBoyId}`);

            logger.debug(`✅ Delivery boy ${normalizedDeliveryBoyId} joined room: delivery-${normalizedDeliveryBoyId}`);

            // Send confirmation that they joined successfully
            socket.emit('joined-notifications-room', {
                success: true,
                message: 'Successfully joined delivery notifications room',
                deliveryBoyId: normalizedDeliveryBoyId
            });

            // Check if there are any active notifications currently waiting for this delivery boy
            const activeNotifications = getActiveNotificationsForDeliveryBoy(normalizedDeliveryBoyId);
            if (activeNotifications.length > 0) {
                logger.debug(`📤 Resending ${activeNotifications.length} active notification(s) to reconnecting delivery boy ${normalizedDeliveryBoyId}`);
                for (const notif of activeNotifications) {
                    socket.emit('new-order', notif);
                }
            }
        });

        // Handle order acceptance
        socket.on('accept-order', async (data: { orderId: string; deliveryBoyId: string }) => {
            try {
                logger.debug(`✅ Delivery boy ${data.deliveryBoyId} accepting order ${data.orderId}`);
                const result = await handleOrderAcceptance(io, data.orderId, String(data.deliveryBoyId).trim());
                socket.emit('accept-order-response', result);
            } catch (error) {
                console.error('❌ Error in accept-order handler:', error);
                socket.emit('accept-order-response', { success: false, message: 'Internal server error' });
            }
        });

        // Handle order rejection
        socket.on('reject-order', async (data: { orderId: string; deliveryBoyId: string }) => {
            try {
                logger.debug(`❌ Delivery boy ${data.deliveryBoyId} rejecting order ${data.orderId}`);
                const result = await handleOrderRejection(io, data.orderId, String(data.deliveryBoyId).trim());
                socket.emit('reject-order-response', result);
            } catch (error) {
                console.error('❌ Error in reject-order handler:', error);
                socket.emit('reject-order-response', { success: false, message: 'Internal server error', allRejected: false });
            }
        });

        // Handle delivery location update (optimized)
        socket.on('update-location', async (data: { orderId: string; latitude: number; longitude: number }) => {
            const { orderId, latitude, longitude } = data;
            const deliveryBoyId = (socket as any).user?.userId;

            if (!deliveryBoyId || !orderId || !latitude || !longitude) return;

            try {
                // 1. Verify Delivery Boy is assigned to this order
                const order = await Order.findOne({ _id: orderId, deliveryBoy: deliveryBoyId }).select('deliveryAddress status');
                if (!order) {
                    console.warn(`⚠️ Unauthorized location update attempt from ${deliveryBoyId} for order ${orderId}`);
                    return;
                }

                // 2. Get Destination (from cache or DB)
                let destination = orderDestinationsCache.get(orderId);

                if (!destination && order.deliveryAddress) {
                    destination = {
                        latitude: order.deliveryAddress.latitude || 0,
                        longitude: order.deliveryAddress.longitude || 0,
                        lastAccess: Date.now(),
                    };
                    orderDestinationsCache.set(orderId, destination);
                } else if (destination) {
                    // Refresh access time so active orders are not evicted by the sweep.
                    destination.lastAccess = Date.now();
                }

                // 3. Calculate Distance & ETA
                let distance = 0;
                let eta = 0;
                if (destination) {
                    distance = calculateDistance(latitude, longitude, destination.latitude, destination.longitude);
                    eta = calculateETA(distance);
                }

                // 4. Determine Status (Simplified)
                let status = 'in_transit';
                if (distance < 100) status = 'nearby';
                // Note: We don't change to 'picked_up'/'delivered' here as those are state transitions, not just location updates

                // 5. Broadcast Immediately (Fast Path)
                const locationUpdatePayload = {
                    orderId,
                    location: { latitude, longitude, timestamp: new Date() },
                    eta,
                    distance,
                    status
                };

                io.to(`order-${orderId}`).emit('location-update', locationUpdatePayload);

                // 6. Throttled DB Update (Slow Path)
                const lastUpdate = locationUpdateThrottler.get(orderId) || 0;
                const now = Date.now();

                if (now - lastUpdate > 30000) { // 30 seconds throttle
                    locationUpdateThrottler.set(orderId, now);

                    try {
                        let tracking = await DeliveryTracking.findOne({ order: orderId });

                        if (!tracking) {
                            tracking = new DeliveryTracking({
                                order: orderId,
                                deliveryBoy: deliveryBoyId,
                                latitude,
                                longitude,
                                currentLocation: { latitude, longitude, timestamp: new Date() },
                                route: [{ lat: latitude, lng: longitude }],
                                status: status as any
                            });
                        } else {
                            tracking.currentLocation = { latitude, longitude, timestamp: new Date() };
                            tracking.latitude = latitude;
                            tracking.longitude = longitude;
                            tracking.route.push({ lat: latitude, lng: longitude });
                            if (tracking.route.length > 50) tracking.route = tracking.route.slice(-50);
                            tracking.distance = distance;
                            tracking.eta = eta;
                            // Only update status if it's a spatial status (nearby/in_transit), don't override Delivered/Picked Up
                            if (tracking.status !== 'delivered' && tracking.status !== 'picked_up' && tracking.status !== 'idle') {
                                tracking.status = status as any;
                            }
                        }
                        await tracking.save();
                    } catch (dbError) {
                        console.error('Error syncing location to DB:', dbError);
                    }
                }
            } catch (err) {
                console.error('Error in socket location update:', err);
            }
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            logger.debug('❌ Socket disconnected:', socket.id, 'Reason:', reason);
        });

        // Error handling
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });
    });

    logger.debug('🔌 Socket.io initialized');
    return io;
};

// Helper function to clear order cache when status changes
export const clearOrderCache = (orderId: string) => {
    orderDestinationsCache.delete(orderId);
    locationUpdateThrottler.delete(orderId);
};

// Helper function to emit location updates
export const emitLocationUpdate = (
    io: SocketIOServer,
    orderId: string,
    data: {
        location: { latitude: number; longitude: number; timestamp: Date };
        eta: number;
        distance: number;
        status: string;
    }
) => {
    io.to(`order-${orderId}`).emit('location-update', {
        orderId,
        ...data,
        timestamp: new Date(),
    });
};
