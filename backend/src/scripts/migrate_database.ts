import dns from 'dns';
// Force IPv4
dns.setDefaultResultOrder('ipv4first');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
    console.warn('Could not set custom DNS servers, continuing with system defaults...');
}

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Schema } from 'mongoose';

// Ensure .env is loaded
dotenv.config();

// Configuration
const SOURCE_URI = 'mongodb+srv://kosilecommerce_db_user:973Chc5YHtBa3F1i@kosil.fcettwg.mongodb.net/SpeeUp';
const TARGET_URI = 'mongodb://palakpatel0342:palakpatel0342@ac-0ieqopd-shard-00-00.23orisn.mongodb.net:27017,ac-0ieqopd-shard-00-01.23orisn.mongodb.net:27017,ac-0ieqopd-shard-00-02.23orisn.mongodb.net:27017/kosil?ssl=true&replicaSet=atlas-12bq80-shard-0&authSource=admin&retryWrites=true&w=majority';

// List of collections we expect to copy. Add more if needed.
const COLLECTIONS_TO_COPY = [
    'admins',
    'categories',
    'customers',
    'deliveries',
    'headercategories',
    'orders',
    'products',
    'sellers',
    'subcategories',
    'subsubcategories',
    'taxes',
    'brands',
    'banners',
    'coupons',
    'faqs',
    'feedbacks',
    'notifications',
    'payments',
    'returns',
    'reviews',
    'settings',
    'wallets',
    'wishlists'
];

async function copyDatabase() {
    let sourceConn: mongoose.Connection | null = null;
    let targetConn: mongoose.Connection | null = null;

    try {
        console.log('🔌 Connecting to source database...');
        sourceConn = mongoose.createConnection(SOURCE_URI, { family: 4 });
        await new Promise<void>((resolve, reject) => {
            sourceConn!.once('open', () => resolve());
            sourceConn!.once('error', (err) => reject(err));
        });
        console.log('✅ Connected to SOURCE database.');

        console.log('🔌 Connecting to target database...');
        targetConn = mongoose.createConnection(TARGET_URI, { family: 4 });
        await new Promise<void>((resolve, reject) => {
            targetConn!.once('open', () => resolve());
            targetConn!.once('error', (err) => reject(err));
        });
        console.log('✅ Connected to TARGET database.');

        if (!sourceConn.db) {
            throw new Error('Source DB handle is missing');
        }

        // Get list of all collections from source
        const sourceCollections = await sourceConn.db.listCollections().toArray();
        console.log(`Found ${sourceCollections.length} collections in source database.`);

        for (const colInfo of sourceCollections) {
            const collectionName = colInfo.name;

            // Skip system collections
            if (collectionName.startsWith('system.')) continue;

            console.log(`\n📦 Processing collection: ${collectionName}`);

            // Fetch documents from source
            const sourceCollection = sourceConn.db.collection(collectionName);
            const docs = await sourceCollection.find({}).toArray();

            if (docs.length === 0) {
                console.log(`   - Collection is empty. Skipping.`);
                continue;
            }
            console.log(`   - Found ${docs.length} documents.`);

            // Insert into target
            if (!targetConn.db) {
                throw new Error('Target DB handle is missing');
            }
            const targetCollection = targetConn.db.collection(collectionName);

            try {
                // Use insertMany with ordered: false to continue if some docs fail
                const result = await targetCollection.insertMany(docs, { ordered: false });
                console.log(`   ✅ Successfully copied ${result.insertedCount} documents.`);
            } catch (err: any) {
                if (err.code === 11000) {
                    // When ordered: false, result might still be populated in error object for some drivers,
                    // or we just acknowledge partial success.
                    console.log(`   ⚠️ Some documents were skipped due to duplicate keys (E11000).`);
                } else {
                    console.error(`   ❌ Error copying collection ${collectionName}:`, err.message);
                }
            }
        }

        console.log('\n✨ Database copy operation completed!');

    } catch (error) {
        console.error('❌ database copy failed:', error);
    } finally {
        if (sourceConn) await sourceConn.close();
        if (targetConn) await targetConn.close();
        console.log('🔌 Connections closed.');
    }
}

// Run the function
copyDatabase();
