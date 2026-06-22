import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { generateToken } from '../services/jwtService';
import Customer from '../models/Customer';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = 'http://localhost:5000/api/v1';

async function runVerification() {
    try {
        // 1. Connect to DB to get a user
        console.log('Connecting to database...');
        // @ts-ignore
        await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://doadmin:q308694215D7ZjYm@db-mongodb-blr1-85094-1b15e347.mongo.ondigitalocean.com/kosil-backend?tls=true&authSource=admin&replicaSet=db-mongodb-blr1-85094");

        // Find a test user (create one if needed, or just pick first)
        let user = await Customer.findOne();
        if (!user) {
            console.log('No user found, creating temp user...');
            user = await Customer.create({
                name: 'Test User',
                phone: '9999999999',
                email: 'test@example.com'
            });
        }

        console.log(`Using user: ${user._id} (${user.name})`);

        // 2. Generate Token
        // @ts-ignore
        const token = generateToken(user._id.toString(), 'Customer');
        console.log('Generated Auth Token');

        // 3. Register FCM Token
        const fcmToken = 'dummy-fcm-token-' + Date.now();
        console.log(`Registering FCM Token: ${fcmToken}`);

        try {
            const saveRes = await axios.post(`${API_URL}/fcm-tokens/save`, {
                token: fcmToken,
                platform: 'web'
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ Save Token Response:', saveRes.data);
        } catch (e: any) {
            console.error('❌ Save Token Failed:', e.response?.data || e.message);
            // Continue anyway to test 'test' endpoint
        }

        // 4. Trigger Test Notification
        console.log('Triggering Test Notification...');
        try {
            const testRes = await axios.post(`${API_URL}/fcm-tokens/test`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ Test Notification Response:', testRes.data);
        } catch (e: any) {
            console.error('❌ Test Notification Failed:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('Verification Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Function to wait for server to start if running separately
setTimeout(runVerification, 3000);
