import { ensureEnvLoaded } from '../config/env';
ensureEnvLoaded();

import mongoose from 'mongoose';
import Order from '../models/Order';

const run = async () => {
  const deliveryBoyId = '694642017853dc37b93292b4'; // Test Delivery

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ Connected.');

  console.log(`🔄 Clearing active/busy orders for Test Delivery...`);
  const result = await Order.updateMany(
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

  console.log(`✅ Updated ${result.modifiedCount} orders to Delivered.`);

  await mongoose.disconnect();
};

run().catch(console.error);
