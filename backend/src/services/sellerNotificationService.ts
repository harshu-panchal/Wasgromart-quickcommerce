import { Server as SocketIOServer } from 'socket.io';
import OrderItem from '../models/OrderItem';
import Seller from '../models/Seller';
import mongoose from 'mongoose';
import { sendPushNotification } from './firebaseAdmin';

/**
 * Notify all sellers involved in an order about a new order or status change
 */
export async function notifySellersOfOrderUpdate(
    io: SocketIOServer,
    order: any,
    type: 'NEW_ORDER' | 'STATUS_UPDATE' | 'ORDER_CANCELLED'
): Promise<void> {
    try {
        if (!io) {
            console.error('Socket.io server not provided to notifySellersOfOrderUpdate');
            return;
        }

        // Get all unique seller IDs from order items
        // If items are populated, we can get them directly, otherwise we need to query
        let orderItems = order.items;

        // If items are just IDs, fetch the full OrderItem details to get seller IDs
        if (orderItems.length > 0 && typeof orderItems[0] === 'string' || orderItems[0] instanceof mongoose.Types.ObjectId) {
            orderItems = await OrderItem.find({ order: order._id });
        }

        const sellerIds = [...new Set(orderItems.map((item: any) => item.seller.toString()))];

        console.log(`🔔 Notifying ${sellerIds.length} sellers about ${type} for order ${order.orderNumber}`);

        for (const sellerId of sellerIds) {
            // Get only items belonging to this seller
            const sellerSpecificItems = orderItems.filter((item: any) => item.seller.toString() === sellerId);

            const notificationData = {
                type,
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
                items: sellerSpecificItems.map((item: any) => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.total,
                    variation: item.variation
                })),
                totalAmount: sellerSpecificItems.reduce((acc: number, item: any) => acc + item.total, 0),
                timestamp: new Date()
            };

            // Emit to seller-specific room
            io.to(`seller-${sellerId}`).emit('seller-notification', notificationData);
            console.log(`📤 Emitted notification to seller-${sellerId}`);

            // Firebase push notification to seller's devices
            try {
                const seller = await Seller.findById(sellerId).select('fcmTokens fcmTokenMobile').lean() as any;
                const tokens: string[] = [
                    ...(seller?.fcmTokens || []),
                    ...(seller?.fcmTokenMobile || []),
                ].filter(Boolean);

                if (tokens.length > 0) {
                    const itemCount = sellerSpecificItems.length;
                    const totalAmount = sellerSpecificItems.reduce((acc: number, item: any) => acc + item.total, 0);
                    const title = type === 'NEW_ORDER'
                        ? `🛒 New Order #${order.orderNumber}`
                        : type === 'ORDER_CANCELLED'
                        ? `❌ Order #${order.orderNumber} Cancelled`
                        : `📦 Order #${order.orderNumber} Updated`;
                    const body = type === 'NEW_ORDER'
                        ? `${itemCount} item${itemCount > 1 ? 's' : ''} • ₹${totalAmount.toFixed(2)} from ${order.customerName}`
                        : `Order status changed to ${order.status}`;

                    await sendPushNotification(tokens, {
                        title,
                        body,
                        data: {
                            type: 'NEW_ORDER',
                            orderId: order._id.toString(),
                            orderNumber: order.orderNumber,
                            link: '/seller/orders',
                        },
                        sound: type === 'NEW_ORDER' ? 'seller_alert' : undefined,
                    });
                    console.log(`🔔 Push notification sent to seller ${sellerId} (${tokens.length} token(s))`);
                }
            } catch (pushErr) {
                console.error(`Failed to send push notification to seller ${sellerId}:`, pushErr);
            }
        }
    } catch (error) {
        console.error('Error in notifySellersOfOrderUpdate:', error);
    }
}
