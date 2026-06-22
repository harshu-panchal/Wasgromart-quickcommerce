import dotenv from 'dotenv';
import mongoose from 'mongoose';
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

        // Find all delivery boys in the database
        const deliveryBoys = await Delivery.find({});
        console.log(`\n📋 Found ${deliveryBoys.length} total delivery boys in database:`);

        for (const db of deliveryBoys) {
            console.log(`\n👤 Name: "${db.name}"`);
            console.log(`   Mobile: ${db.mobile}`);
            console.log(`   isOnline: ${db.isOnline}`);
            console.log(`   status: "${db.status}"`);
            console.log(`   location:`, JSON.stringify(db.location));
            console.log(`   fcmTokens:`, db.fcmTokens);
            console.log(`   fcmTokenMobile:`, db.fcmTokenMobile);
        }

    } catch (error) {
        console.error('❌ Error running diagnostic:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
