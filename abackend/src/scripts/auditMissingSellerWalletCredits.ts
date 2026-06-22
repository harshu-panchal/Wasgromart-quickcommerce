import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import WalletTransaction from "../models/WalletTransaction";
import Seller from "../models/Seller";

dotenv.config();

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database\n");

  const deliveredOrders = await Order.find({ status: "Delivered" }).select(
    "_id orderNumber paymentMethod deliveredAt",
  );

  const sellerImpact = new Map<
    string,
    {
      sellerName: string;
      storeName: string;
      balance: number;
      missingOrders: string[];
      creditedOrders: number;
    }
  >();

  let ordersWithMissingCredits = 0;
  let ordersFullyCredited = 0;

  for (const order of deliveredOrders) {
    const items = await OrderItem.find({ order: order._id }).select("seller");
    if (items.length === 0) continue;

    const sellerIds = [...new Set(items.map((item) => String(item.seller)))];

    for (const sellerId of sellerIds) {
      const credit = await WalletTransaction.findOne({
        userType: "SELLER",
        userId: sellerId,
        relatedOrder: order._id,
        type: "Credit",
      });

      if (!credit) {
        ordersWithMissingCredits++;

        if (!sellerImpact.has(sellerId)) {
          const seller = await Seller.findById(sellerId).select(
            "sellerName storeName balance",
          );
          sellerImpact.set(sellerId, {
            sellerName: seller?.sellerName || "Unknown",
            storeName: seller?.storeName || "Unknown",
            balance: seller?.balance ?? 0,
            missingOrders: [],
            creditedOrders: 0,
          });
        }

        sellerImpact.get(sellerId)!.missingOrders.push(order.orderNumber);
      } else {
        if (!sellerImpact.has(sellerId)) {
          const seller = await Seller.findById(sellerId).select(
            "sellerName storeName balance",
          );
          sellerImpact.set(sellerId, {
            sellerName: seller?.sellerName || "Unknown",
            storeName: seller?.storeName || "Unknown",
            balance: seller?.balance ?? 0,
            missingOrders: [],
            creditedOrders: 0,
          });
        }
        sellerImpact.get(sellerId)!.creditedOrders++;
      }
    }

    const allSellersCredited = await Promise.all(
      sellerIds.map((sellerId) =>
        WalletTransaction.exists({
          userType: "SELLER",
          userId: sellerId,
          relatedOrder: order._id,
          type: "Credit",
        }),
      ),
    );

    if (allSellersCredited.every(Boolean)) {
      ordersFullyCredited++;
    }
  }

  const affectedSellers = [...sellerImpact.values()].filter(
    (s) => s.missingOrders.length > 0,
  );

  affectedSellers.sort((a, b) => b.missingOrders.length - a.missingOrders.length);

  console.log("=== Seller wallet audit (delivered orders) ===");
  console.log(`Total delivered orders: ${deliveredOrders.length}`);
  console.log(`Orders with at least one missing seller credit: ${ordersWithMissingCredits}`);
  console.log(`Orders fully credited for all sellers: ${ordersFullyCredited}`);
  console.log(`Sellers with missing credits: ${affectedSellers.length}\n`);

  if (affectedSellers.length === 0) {
    console.log("No other sellers affected — all delivered orders have wallet credits.");
  } else {
    console.log("Affected sellers:");
    for (const seller of affectedSellers) {
      console.log(
        `- ${seller.storeName} (${seller.sellerName}) | balance: ₹${seller.balance.toFixed(2)} | missing: ${seller.missingOrders.length} order(s) | credited: ${seller.creditedOrders}`,
      );
      console.log(`  Orders: ${seller.missingOrders.join(", ")}`);
    }
  }

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
