
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Commission from '../src/models/Commission';
import Order from '../src/models/Order';
import WithdrawRequest from '../src/models/WithdrawRequest';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const debugFinancials = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI not found');
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Total GMV
        const totalGMVResult = await mongoose.model('Order').aggregate([
            { $match: { status: { $ne: 'Cancelled' }, paymentStatus: 'Paid' } },
            { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
        ]);
        const totalGMV = totalGMVResult.length > 0 ? totalGMVResult[0].total : 0;
        console.log('Total GMV:', totalGMV, 'Count:', totalGMVResult.length > 0 ? totalGMVResult[0].count : 0);

        // 2. Seller Commissions
        const sellerCommResult = await Commission.aggregate([
            { $match: { type: 'SELLER', status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }
        ]);
        const sellerCommissions = sellerCommResult.length > 0 ? sellerCommResult[0].total : 0;
        console.log('Seller Commissions:', sellerCommissions, 'Count:', sellerCommResult.length > 0 ? sellerCommResult[0].count : 0);

        // 3. Delivery Commissions
        const deliveryCommResult = await Commission.aggregate([
            { $match: { type: 'DELIVERY_BOY', status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }
        ]);
        const deliveryCommissions = deliveryCommResult.length > 0 ? deliveryCommResult[0].total : 0;
        console.log('Delivery Commissions:', deliveryCommissions, 'Count:', deliveryCommResult.length > 0 ? deliveryCommResult[0].count : 0);

        // 4. Order Fees
        const orderFeesResult = await mongoose.model('Order').aggregate([
            { $match: { status: { $ne: 'Cancelled' }, paymentStatus: 'Paid' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $add: ['$platformFee', '$shipping'] } },
                    platformFee: { $sum: '$platformFee' },
                    shipping: { $sum: '$shipping' }
                }
            }
        ]);
        const orderFees = orderFeesResult.length > 0 ? orderFeesResult[0].total : 0;
        console.log('Order Fees Total:', orderFees);
        if (orderFeesResult.length > 0) {
            console.log('  - Platform Fee Sum:', orderFeesResult[0].platformFee);
            console.log('  - Shipping Sum:', orderFeesResult[0].shipping);
        }

        // 5. Total Admin Earnings
        const totalAdminEarnings = sellerCommissions + orderFees - deliveryCommissions;
        console.log('-------------------------------------------');
        console.log('Calculated Total Admin Earnings:', totalAdminEarnings);
        console.log(`Formula: ${sellerCommissions} (SellerComm) + ${orderFees} (Fees) - ${deliveryCommissions} (DelComm)`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

debugFinancials();
