import dotenv from 'dotenv';
import mongoose from 'mongoose';

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
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Collections in database:');
    for (const coll of collections) {
      console.log(` - ${coll.name}`);
    }

    // Let's find any collection name containing "deliver"
    const deliveryCollections = collections.filter(c => c.name.toLowerCase().includes('deliver'));
    console.log('\n🔎 Delivery-related collections:', deliveryCollections.map(c => c.name));

    for (const coll of deliveryCollections) {
      const collection = db.collection(coll.name);
      
      // Print existing indexes
      const indexes = await collection.listIndexes().toArray();
      console.log(`\n📋 Existing indexes for collection "${coll.name}":`);
      for (const idx of indexes) {
        console.log(`   Name: "${idx.name}", Key:`, JSON.stringify(idx.key));
      }

      // Drop existing 2dsphere index on location if any to rebuild cleanly
      const geoIndex = indexes.find(idx => Object.values(idx.key).includes('2dsphere'));
      if (geoIndex) {
        console.log(`🧹 Dropping existing 2dsphere index: "${geoIndex.name}"`);
        await collection.dropIndex(geoIndex.name);
      }

      // Create new 2dsphere index on "location"
      console.log(`⚡ Creating 2dsphere index on "location" for "${coll.name}"...`);
      const indexName = await collection.createIndex({ location: '2dsphere' });
      console.log(`✅ Index created successfully! Index name: "${indexName}"`);

      // Verify the new index
      const newIndexes = await collection.listIndexes().toArray();
      console.log(`📋 New indexes for "${coll.name}":`);
      for (const idx of newIndexes) {
        console.log(`   Name: "${idx.name}", Key:`, JSON.stringify(idx.key));
      }
    }

  } catch (error) {
    console.error('❌ Error creating index:', error);
  } finally {
    await mongoose.disconnect();
  }
};

run();
