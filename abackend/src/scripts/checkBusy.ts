import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order';

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing');
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    const OrderModel = (Order as any).default || Order;

    const busyOrders = await OrderModel.find({
      deliveryBoy: '694642017853dc37b93292b4',
      status: { $nin: ['Delivered', 'Cancelled', 'Rejected', 'Returned'] }
    });

    console.log('Busy Orders for Test Delivery in database:', busyOrders.map((o: any) => ({
      id: o._id,
      number: o.orderNumber,
      status: o.status,
      deliveryBoyStatus: o.deliveryBoyStatus
    })));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
