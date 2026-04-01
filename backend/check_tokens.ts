
import mongoose from 'mongoose';
import Delivery from './src/models/Delivery';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
}

async function checkTokens() {
    try {
        await mongoose.connect(MONGODB_URI as string);
        console.log('Connected to MongoDB');

        const deliveries = await Delivery.find({ fcmTokens: { $exists: true, $not: { $size: 0 } } });
        console.log(`Found ${deliveries.length} delivery partners with FCM tokens`);

        deliveries.forEach(d => {
            console.log(`Delivery: ${d.name} (${d.mobile}), Tokens: ${d.fcmTokens?.length}`);
            console.log(`Tokens: ${JSON.stringify(d.fcmTokens)}`);
        });

        const allDeliveries = await Delivery.find().limit(5);
        console.log('Last 5 deliveries:');
        allDeliveries.forEach(d => {
            console.log(`- ${d.name} (${d.mobile}), Status: ${d.status}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkTokens();
