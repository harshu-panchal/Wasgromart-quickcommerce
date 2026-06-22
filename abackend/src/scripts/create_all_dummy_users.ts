
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../models/Admin';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Customer from '../models/Customer';
import bcrypt from 'bcrypt';

dotenv.config();

const run = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI missing');
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const mobile = '9111966732'; // Special bypass number
        const password = 'password123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 1. Admin
        let admin = await Admin.findOne({ mobile });
        if (!admin) {
            await Admin.create({
                firstName: "Dummy",
                lastName: "Admin",
                mobile: mobile,
                email: "admin@dummy.com",
                password: passwordHash,
                role: "Super Admin"
            });
            console.log('Admin created');
        } else {
            console.log('Admin already exists');
        }

        // 2. Seller
        let seller = await Seller.findOne({ mobile });
        if (!seller) {
            await Seller.create({
                sellerName: "Dummy Seller",
                storeName: "Dummy Mart",
                mobile: mobile,
                email: "seller@dummy.com",
                category: "Grocery",
                categories: ["Grocery"],
                address: "Dummy Address",
                city: "Localhost",
                status: "Approved",
                serviceRadiusKm: 10,
                latitude: "0",
                longitude: "0",
                location: {
                    type: "Point",
                    coordinates: [0, 0]
                },
                password: passwordHash
            });
            console.log('Seller created');
        } else {
            console.log('Seller already exists');
        }

        // 3. Delivery
        let delivery = await Delivery.findOne({ mobile });
        if (!delivery) {
            await Delivery.create({
                name: "Dummy Delivery",
                mobile: mobile,
                email: "delivery@dummy.com",
                password: passwordHash,
                status: "Active",
                isOnline: true,
                address: "Dummy Address",
                city: "Localhost",
                location: {
                    type: "Point",
                    coordinates: [0, 0]
                }
            });
            console.log('Delivery created');
        } else {
            console.log('Delivery already exists');
        }

        // 4. Customer
        let customer = await Customer.findOne({ phone: mobile });
        if (!customer) {
            await Customer.create({
                name: "Dummy Customer",
                phone: mobile,
                email: "customer@dummy.com",
                status: "Active",
                refCode: "DUMMY123"
            });
            console.log('Customer created');
        } else {
            console.log('Customer already exists');
        }

        console.log('==========================================');
        console.log('DUMMY CREDENTIALS FOR TESTING:');
        console.log('Mobile Number: ' + mobile);
        console.log('OTP: 1234');
        console.log('Password (if needed): ' + password);
        console.log('Works for: Admin, Seller, Delivery, Customer');
        console.log('==========================================');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
