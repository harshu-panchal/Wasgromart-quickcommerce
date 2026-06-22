import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import WalletTransaction from "../models/WalletTransaction";
import Seller from "../models/Seller";
import { distributeCommissions } from "../services/commissionService";

dotenv.config();

/**
 * Backfill seller wallet credits for delivered orders that were marked
 * delivered before the wallet-settlement bug was fixed.
 *
 * Usage:
 *   npx ts-node src/scripts/reconcileDeliveredOrderWallets.ts
 *   npx ts-node src/scripts/reconcileDeliveredOrderWallets.ts <sellerId>
 */
async function run() {
  const sellerIdArg = process.argv[2];

  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to database");

  try {
    let sellerFilter: mongoose.Types.ObjectId | undefined;
    if (sellerIdArg) {
      if (!mongoose.isValidObjectId(sellerIdArg)) {
        console.error("Invalid seller id:", sellerIdArg);
        process.exit(1);
      }
      sellerFilter = new mongoose.Types.ObjectId(sellerIdArg);
      const seller = await Seller.findById(sellerIdArg).select("sellerName storeName balance");
      if (!seller) {
        console.error("Seller not found:", sellerIdArg);
        process.exit(1);
      }
      console.log(
        `Reconciling delivered orders for ${seller.sellerName} (${seller.storeName}), current balance: ${seller.balance}`,
      );
    }

    const deliveredOrders = await Order.find({ status: "Delivered" }).select("_id orderNumber");
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const order of deliveredOrders) {
      const itemQuery: Record<string, unknown> = { order: order._id };
      if (sellerFilter) {
        itemQuery.seller = sellerFilter;
      }

      const items = await OrderItem.find(itemQuery).select("seller");
      if (items.length === 0) {
        continue;
      }

      const sellerIds = [...new Set(items.map((item) => String(item.seller)))];
      const missingCredit = await WalletTransaction.exists({
        userType: "SELLER",
        userId: { $in: sellerIds },
        relatedOrder: order._id,
        type: "Credit",
      });

      if (missingCredit) {
        skipped++;
        continue;
      }

      try {
        await distributeCommissions(String(order._id));
        processed++;
        console.log(`Credited wallets for order ${order.orderNumber} (${order._id})`);
      } catch (error: any) {
        failed++;
        console.error(
          `Failed order ${order.orderNumber} (${order._id}):`,
          error?.message || error,
        );
      }
    }

    if (sellerFilter) {
      const seller = await Seller.findById(sellerIdArg).select("balance");
      console.log(`Seller balance after reconcile: ${seller?.balance ?? "n/a"}`);
    }

    console.log(`Done. processed=${processed}, skipped=${skipped}, failed=${failed}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
