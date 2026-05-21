import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order';
import { findDeliveryBoysNearSellerLocations } from '../services/orderNotificationService';

dotenv.config();

const orderId = '6a0ee8c777d8686c566337b8';

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing');
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    const OrderModel = (Order as any).default || Order;

    const fullOrder = await OrderModel.findById(orderId)
      .populate({
        path: 'items',
        populate: { path: 'seller' }
      })
      .lean();

    if (!fullOrder) {
      console.error('❌ Order not found in database');
      return;
    }

    console.log('📦 Order Number:', fullOrder.orderNumber);
    console.log('📦 Order items populated:', fullOrder.items);

    console.log('📍 Running findDeliveryBoysNearSellerLocations...');
    const nearbyBoys = await findDeliveryBoysNearSellerLocations(fullOrder);
    console.log('📍 Nearby boys found:', nearbyBoys);

  } catch (error: any) {
    console.error('❌ Error during trigger execution:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
