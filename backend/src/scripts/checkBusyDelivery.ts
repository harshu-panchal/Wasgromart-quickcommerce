import { ensureEnvLoaded } from '../config/env';
ensureEnvLoaded();

import mongoose from 'mongoose';
import Order from '../models/Order';
import Delivery from '../models/Delivery';

const run = async () => {
  const deliveryBoyId = '694642017853dc37b93292b4'; // Test Delivery

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ Connected.');

  // Find any active orders for this delivery boy
  const activeOrders = await Order.find({
    deliveryBoy: deliveryBoyId,
    deliveryBoyStatus: { $in: ["Assigned", "Picked Up", "In Transit"] },
    status: { $nin: ["Delivered", "Cancelled", "Rejected", "Returned"] },
  });

  console.log(`\n🚨 Active/Busy orders for Test Delivery in DB: ${activeOrders.length}`);
  for (const order of activeOrders) {
    console.log(`- Order: ${order.orderNumber} (ID: ${order._id})`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Delivery Boy Status: ${order.deliveryBoyStatus}`);
  }

  // Let's also print ALL orders assigned to this delivery boy
  const allOrders = await Order.find({ deliveryBoy: deliveryBoyId });
  console.log(`\n📋 All orders assigned to Test Delivery in DB: ${allOrders.length}`);
  for (const order of allOrders) {
    console.log(`- Order: ${order.orderNumber} (ID: ${order._id}) - Status: ${order.status}, Delivery Status: ${order.deliveryBoyStatus}`);
  }

  await mongoose.disconnect();
};

run().catch(console.error);
