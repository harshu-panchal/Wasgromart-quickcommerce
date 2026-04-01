
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from '../models/Customer';

dotenv.config();

const listCustomers = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wasgro-mart';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const customers = await Customer.find({});
        console.log(`Found ${customers.length} customers:`);
        customers.forEach(c => {
            console.log(`- ID: ${c._id}, Name: ${c.name}, Email: ${c.email}, Phone: ${c.phone}`);
        });

        await mongoose.disconnect();
        console.log('Disconnected');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

listCustomers();
