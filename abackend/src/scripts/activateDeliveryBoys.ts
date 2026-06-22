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

        // Update "Test Delivery"
        const testDelivery = await Delivery.findOne({ mobile: '6268423925' });
        if (testDelivery) {
            testDelivery.status = 'Active';
            await testDelivery.save();
            console.log(`⚡ Activated delivery boy: "${testDelivery.name}" (Mobile: ${testDelivery.mobile})`);
        } else {
            console.log('⚠️ "Test Delivery" not found in database');
        }

        // Update "Harshvardhan Panchal"
        const harshDelivery = await Delivery.findOne({ mobile: '6264715409' });
        if (harshDelivery) {
            harshDelivery.status = 'Active';
            await harshDelivery.save();
            console.log(`⚡ Activated delivery boy: "${harshDelivery.name}" (Mobile: ${harshDelivery.mobile})`);
        }

        console.log('🎉 Status activation successfully completed!');

    } catch (error) {
        console.error('❌ Error executing status updates:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
