import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';

dotenv.config();

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing');
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to Database successfully!');

    const db = mongoose.connection.db;

    // --- 1. CLEANUP INVALID SELLER LOCATIONS ---
    console.log('\n🧹 Cleaning up invalid seller locations...');
    const invalidSellers = await Seller.find({
      $or: [
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates': { $size: 0 } },
        { 'location.coordinates': null },
        { 'location': { $exists: true, $type: 'object' }, 'location.coordinates': { $exists: false } }
      ]
    });

    console.log(`Found ${invalidSellers.length} invalid seller locations.`);
    for (const seller of invalidSellers) {
      console.log(`  Fixing seller: "${seller.storeName}" (${seller._id})`);
      seller.location = undefined;
      await seller.save();
    }
    console.log('✅ Seller locations cleaned up.');

    // --- 2. CLEANUP INVALID DELIVERY LOCATIONS ---
    console.log('\n🧹 Cleaning up invalid delivery locations...');
    const invalidDeliveries = await Delivery.find({
      $or: [
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates': { $size: 0 } },
        { 'location.coordinates': null },
        { 'location': { $exists: true, $type: 'object' }, 'location.coordinates': { $exists: false } }
      ]
    });

    console.log(`Found ${invalidDeliveries.length} invalid delivery locations.`);
    for (const delivery of invalidDeliveries) {
      console.log(`  Fixing delivery boy: "${delivery.name}" (${delivery._id})`);
      delivery.location = undefined;
      await delivery.save();
    }
    console.log('✅ Delivery locations cleaned up.');

    // --- 3. CREATE INDEXES ---
    // Sellers index
    console.log('\n⚡ Creating 2dsphere index on "location" for "sellers"...');
    try {
      const sellerColl = db.collection('sellers');
      const sellerIndexes = await sellerColl.listIndexes().toArray();
      const geoIdx = sellerIndexes.find(idx => Object.values(idx.key).includes('2dsphere'));
      if (geoIdx) {
        console.log(`  Dropping old seller geo index: "${geoIdx.name}"`);
        await sellerColl.dropIndex(geoIdx.name);
      }
      const idxName = await sellerColl.createIndex({ location: '2dsphere' });
      console.log(`✅ Seller index created successfully: "${idxName}"`);
    } catch (err: any) {
      console.error('❌ Failed to index sellers:', err.message);
    }

    // Deliveries index
    console.log('\n⚡ Creating 2dsphere index on "location" for "deliveries"...');
    try {
      const deliveryColl = db.collection('deliveries');
      const deliveryIndexes = await deliveryColl.listIndexes().toArray();
      const geoIdx = deliveryIndexes.find(idx => Object.values(idx.key).includes('2dsphere'));
      if (geoIdx) {
        console.log(`  Dropping old delivery geo index: "${geoIdx.name}"`);
        await deliveryColl.dropIndex(geoIdx.name);
      }
      const idxName = await deliveryColl.createIndex({ location: '2dsphere' });
      console.log(`✅ Delivery index created successfully: "${idxName}"`);
    } catch (err: any) {
      console.error('❌ Failed to index deliveries:', err.message);
    }

  } catch (error) {
    console.error('❌ Error during cleanup and index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🏁 Done!');
  }
};

run();
