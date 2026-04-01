
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Order from '../src/models/Order';
import Commission from '../src/models/Commission';
import WalletTransaction from '../src/models/WalletTransaction';
import Delivery from '../src/models/Delivery';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const investigateOrder = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI not found');
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const orderNumber = 'ORD1769532963174432';
        const order = await Order.findOne({ orderNumber });

        if (!order) {
            console.log('Order not found:', orderNumber);
            process.exit(0);
        }

        console.log('--- ORDER DETAILS ---');
        console.log('ID:', order._id);
        console.log('Status:', order.status);
        console.log('Subtotal:', order.subtotal);
        console.log('Delivery Distance:', order.deliveryDistanceKm);
        console.log('Delivery Boy ID:', order.deliveryBoy);

        console.log('\n--- COMMISSIONS ---');
        const commissions = await Commission.find({ order: order._id });
        commissions.forEach(c => {
            console.log(`Type: ${c.type}, Amount: ${c.commissionAmount}, Status: ${c.status}, CreatedAt: ${c.createdAt}`);
        });

        console.log('\n--- WALLET TRANSACTIONS ---');
        // Check for transactions related to this order OR commissions of this order
        const commissionIds = commissions.map(c => c._id);
        const transactions = await WalletTransaction.find({
            $or: [
                { relatedOrder: order._id },
                { relatedCommission: { $in: commissionIds } }
            ]
        });

        transactions.forEach(t => {
            console.log(`UserType: ${t.userType}, Type: ${t.type}, Amount: ${t.amount}, Desc: ${t.description}`);
        });

        if (order.deliveryBoy) {
            console.log('\n--- DELIVERY BOY ---');
            const deliveryBoy = await Delivery.findById(order.deliveryBoy);
            if (deliveryBoy) {
                console.log('Name:', deliveryBoy.name);
                console.log('Balance:', deliveryBoy.balance);
                console.log('Cash Collected:', deliveryBoy.cashCollected);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

investigateOrder();
