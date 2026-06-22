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
    const order = await OrderModel.findById('6a0ee8c777d8686c566337b8');
    if (!order) {
      console.error('❌ Order not found');
      return;
    }

    console.log('Order Details:');
    console.log('- Status:', order.status);
    console.log('- Delivery Boy Status:', order.deliveryBoyStatus);
    console.log('- Delivery Boy Assigned:', order.deliveryBoy);
    console.log('- Admin Notes:', order.adminNotes);
    console.log('- Updated At:', order.updatedAt);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
