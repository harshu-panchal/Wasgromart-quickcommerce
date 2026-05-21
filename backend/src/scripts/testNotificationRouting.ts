import { ensureEnvLoaded } from '../config/env';
ensureEnvLoaded();

import mongoose from 'mongoose';
import axios from 'axios';
import { io as socketClient } from 'socket.io-client';
import { generateToken } from '../services/jwtService';
import Order from '../models/Order';

const run = async () => {
  const sellerId = '695b7d5ea0b51822cd33332b'; // Appzeto E-commerce
  const deliveryBoyId = '694642017853dc37b93292b4'; // Test Delivery
  const orderId = '6a0ee8c777d8686c566337b8'; // Fresh Kiwi order

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ Connected to MongoDB.');

  // 1. Reset Order State in Database to 'Received'
  console.log(`🔄 Resetting order ${orderId} in database to "Received" status...`);
  await Order.findByIdAndUpdate(orderId, {
    $set: {
      status: 'Received',
      assignedAt: null
    },
    $unset: {
      deliveryBoy: "",
      deliveryBoyStatus: ""
    }
  });
  console.log('✅ Order reset successfully.');

  // Also clear any other busy/active orders for this delivery boy to prevent them from being filtered out
  console.log(`🔄 Resetting any other active/busy orders for Test Delivery to Delivered...`);
  await Order.updateMany(
    {
      deliveryBoy: deliveryBoyId,
      deliveryBoyStatus: { $in: ["Assigned", "Picked Up", "In Transit"] },
      status: { $nin: ["Delivered", "Cancelled", "Rejected", "Returned"] },
    },
    {
      $set: {
        status: 'Delivered',
        deliveryBoyStatus: 'Delivered'
      }
    }
  );
  console.log('✅ Active orders cleaned up.');

  // Disconnect mongoose so it doesn't hang
  await mongoose.disconnect();

  // 2. Generate Auth Tokens
  const sellerToken = generateToken(sellerId, 'Seller');
  const deliveryToken = generateToken(deliveryBoyId, 'Delivery');

  console.log('🔑 Generated Seller Token:', sellerToken.substring(0, 30) + '...');
  console.log('🔑 Generated Delivery Token:', deliveryToken.substring(0, 30) + '...');

  // 3. Connect "Test Delivery" Socket Client
  console.log('🔌 Connecting "Test Delivery" Socket Client to http://localhost:5000...');
  const socket = socketClient('http://localhost:5000', {
    auth: { token: deliveryToken },
    transports: ['websocket'],
  });

  let joinedNotifications = false;

  socket.on('connect', () => {
    console.log('🔌 "Test Delivery" connected to socket! Socket ID:', socket.id);
    console.log('🔔 Emitting join-delivery-notifications...');
    socket.emit('join-delivery-notifications', deliveryBoyId);
  });

  socket.on('joined-notifications-room', async (data) => {
    console.log('✅ "Test Delivery" joined room successfully:', data);
    joinedNotifications = true;

    // Wait a brief second to ensure room is fully active in Socket.io adapter
    setTimeout(async () => {
      // 4. Accept the order via PATCH API as the Seller
      console.log(`📤 Sending PATCH /api/v1/orders/${orderId}/status ('Accepted') as Seller...`);
      try {
        const response = await axios.patch(
          `http://localhost:5000/api/v1/orders/${orderId}/status`,
          { status: 'Accepted' },
          {
            headers: {
              Authorization: `Bearer ${sellerToken}`,
            },
          }
        );
        console.log('✅ Seller acceptance API response:', response.data);
      } catch (err: any) {
        console.error('❌ Failed to accept order via API:', err.response?.data || err.message);
        socket.disconnect();
        process.exit(1);
      }
    }, 1000);
  });

  // 5. Listen for 'new-order' notification
  socket.on('new-order', (orderData) => {
    console.log('\n🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉');
    console.log('🔔 SUCCESS: "Test Delivery" RECEIVED ORDER NOTIFICATION VIA SOCKET!');
    console.log('📦 Notification Payload:', orderData);
    console.log('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉\n');

    // Clean up and exit successfully
    socket.disconnect();
    process.exit(0);
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
    process.exit(1);
  });

  // Timeout safety net (15 seconds)
  setTimeout(() => {
    console.log('⏱️ Timeout waiting for socket notification.');
    socket.disconnect();
    process.exit(1);
  }, 15000);
};

run().catch(err => {
  console.error('❌ Unhandled script error:', err);
  process.exit(1);
});
