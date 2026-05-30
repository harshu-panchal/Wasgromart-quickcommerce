import mongoose from 'mongoose';
import Seller from '../models/Seller';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Backfills `serviceAreaMode` on every Seller document that does not already
 * have it set. Existing sellers default to 'radius', preserving their current
 * customer-feed behavior. New sellers get the same default through the schema.
 */
async function migrateServiceAreaMode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/speedup');
    console.log('Connected to MongoDB');

    const result = await Seller.updateMany(
      { serviceAreaMode: { $exists: false } },
      { $set: { serviceAreaMode: 'radius' } }
    );

    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    await mongoose.disconnect();
    console.log('Migration completed.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateServiceAreaMode();
