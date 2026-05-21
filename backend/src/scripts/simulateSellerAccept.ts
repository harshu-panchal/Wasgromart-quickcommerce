import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import { generateToken } from '../services/jwtService';
import axios from 'axios';

dotenv.config();

const orderId = '6a0ee8c777d8686c566337b8';
const sellerId = '695b7d5ea0b51822cd33332b';

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing');
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    const OrderModel = (Order as any).default || Order;
    const OrderItemModel = (OrderItem as any).default || OrderItem;

    // Reset order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      console.error('❌ Order not found');
      return;
    }

    console.log(`📦 Found order ${order.orderNumber}. Current status: ${order.status}`);
    
    order.status = 'Received';
    order.deliveryBoy = undefined;
    order.deliveryBoyStatus = undefined;
    order.adminNotes = `[${new Date().toISOString()}] Resetting order for local socket testing.`;
    await order.save();

    // Reset items to Pending
    await OrderItemModel.updateMany({ order: orderId }, { status: 'Pending' });

    console.log('🔄 Order reset to Received status successfully!');

    // Generate Seller JWT Token
    const token = generateToken(sellerId, 'Seller');
    console.log('🔑 Generated Seller JWT Token:', token);

    // Call local server PATCH endpoint
    console.log('📤 Sending PATCH request to local server...');
    const response = await axios.patch(
      `http://localhost:5000/api/v1/orders/${orderId}/status`,
      { status: 'Accepted' },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✨ Server response status:', response.status);
    console.log('✨ Server response data:', response.data);

  } catch (error: any) {
    if (error.response) {
      console.error('❌ API Request failed:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error running simulation:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

run();
