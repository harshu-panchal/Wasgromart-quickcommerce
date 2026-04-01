
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import AppSettings from '../src/models/AppSettings';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const enableDynamicDelivery = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI not found in .env');
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const settings = await AppSettings.findOne();

        if (settings) {
            console.log('Current Settings found. Updating...');

            settings.deliveryConfig = {
                isDistanceBased: true,
                googleMapsKey: 'AIzaSyC2UW5-Nt9KidxOfBRrZImeBRh9SOMGluo',
                baseCharge: 30,
                baseDistance: 2,
                kmRate: 10,
                deliveryBoyKmRate: 5
            };

            // Also set a meaningful free delivery threshold if not set
            if (!settings.freeDeliveryThreshold) {
                settings.freeDeliveryThreshold = 500;
            }

            settings.deliveryCharges = 0; // Set static charge to 0 to avoid confusion

            await settings.save();
            console.log('Configuration updated successfully!');
            console.log('New Delivery Config:', JSON.stringify(settings.deliveryConfig, null, 2));
        } else {
            console.log('No settings found. Creating new...');
            await AppSettings.create({
                appName: "Kosil",
                contactEmail: "contact@kosil.com",
                contactPhone: "1234567890",
                deliveryConfig: {
                    isDistanceBased: true,
                    googleMapsKey: 'AIzaSyC2UW5-Nt9KidxOfBRrZImeBRh9SOMGluo',
                    baseCharge: 30,
                    baseDistance: 2,
                    kmRate: 10,
                    deliveryBoyKmRate: 5
                },
                freeDeliveryThreshold: 500,
                deliveryCharges: 0
            });
            console.log('Settings created successfully!');
        }

    } catch (error) {
        console.error('Error updating settings:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

enableDynamicDelivery();
