import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import { findDeliveryBoysNearSellerLocations } from '../services/orderNotificationService';

dotenv.config();

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing');
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to Database successfully!');

    // 1. Get recent orders
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'items',
        populate: { path: 'seller' }
      });

    console.log(`\n📋 Recent ${recentOrders.length} orders in database:`);
    for (const order of recentOrders) {
      console.log(`\n📦 Order Number: ${order.orderNumber}`);
      console.log(`   ID: ${order._id}`);
      console.log(`   Status: "${order.status}"`);
      console.log(`   Delivery Boy Status: "${order.deliveryBoyStatus}"`);
      console.log(`   Delivery Boy Assigned: ${order.deliveryBoy ? order.deliveryBoy : 'None'}`);
      console.log(`   Customer: ${order.customerName} (${order.customerPhone})`);
      console.log(`   Created At: ${order.createdAt}`);
      
      // Get unique sellers
      const sellerIds = [
        ...new Set(
          order.items
            ?.map((item: any) => {
              const seller = item.seller;
              if (!seller) return null;
              if (typeof seller === "object") {
                return seller._id ? seller._id.toString() : null;
              }
              return seller.toString();
            })
            .filter(Boolean) || [],
        ),
      ];

      console.log(`   Sellers involved:`, sellerIds);
      for (const sId of sellerIds) {
        const seller = await Seller.findById(sId);
        if (seller) {
          console.log(`     Store: "${seller.storeName}" (${seller.city})`);
          console.log(`     Location:`, JSON.stringify(seller.location));
          console.log(`     Service Radius: ${seller.serviceRadiusKm} km`);
        }
      }

      // Check proximity calculations for this order
      console.log(`\n   🔍 Proximity / notification routing analysis:`);
      try {
        const nearbyBoys = await findDeliveryBoysNearSellerLocations(order);
        console.log(`   📍 Nearby / Eligible delivery boy IDs:`, nearbyBoys.map(id => id.toString()));
        
        // Let's also details of these delivery boys
        for (const boyId of nearbyBoys) {
          const db = await Delivery.findById(boyId);
          if (db) {
            console.log(`     - Eligible: "${db.name}" (Mobile: ${db.mobile}) - status: ${db.status}, isOnline: ${db.isOnline}`);
            // Distance to each seller
            for (const sId of sellerIds) {
              const seller = await Seller.findById(sId);
              if (seller && seller.location && seller.location.coordinates && db.location && db.location.coordinates) {
                const [sLng, sLat] = seller.location.coordinates;
                const [dbLng, dbLat] = db.location.coordinates;
                const dist = calculateDistance(sLat, sLng, dbLat, dbLng);
                console.log(`       Distance to "${seller.storeName}": ${dist.toFixed(3)} km`);
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`   ❌ Error calculating nearby delivery boys:`, err.message);
      }
    }

    // 2. Also print active and online delivery boys details
    const activeOnlineBoys = await Delivery.find({ status: 'Active', isOnline: true });
    console.log(`\n⚡ Active and Online Delivery Boys: ${activeOnlineBoys.length}`);
    for (const db of activeOnlineBoys) {
      console.log(`   - Name: "${db.name}" (Mobile: ${db.mobile}), Location:`, JSON.stringify(db.location));
    }

  } catch (error) {
    console.error('❌ Error running checkOrderNotifications:', error);
  } finally {
    await mongoose.disconnect();
  }
};

run();
