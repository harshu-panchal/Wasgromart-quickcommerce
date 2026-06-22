import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI missing");
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to database");

    // Total orders count
    const totalOrders = await Order.countDocuments();
    
    // Group orders by status
    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    console.log("\n=== ORDER STATISTICS ===");
    console.log(`Total Orders in Database: ${totalOrders}`);
    console.log("\nStatus Breakdown:");
    
    let sumBreakdown = 0;
    statusCounts.forEach((group: any) => {
      console.log(`- Status: "${group._id || "null"}", Count: ${group.count}`);
      sumBreakdown += group.count;
    });

    console.log(`\nSum of all status counts: ${sumBreakdown}`);

    // Map according to our dashboard categories
    const completedStatuses = ["Delivered"];
    const pendingStatuses = ["Received", "Accepted", "Pending", "Processed", "Shipped", "Out for Delivery"];
    const cancelledStatuses = ["Cancelled", "Rejected", "Returned"];

    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let unmatchedCount = 0;
    const unmatchedGroups: any[] = [];

    statusCounts.forEach((group: any) => {
      const status = group._id;
      if (completedStatuses.includes(status)) {
        completedCount += group.count;
      } else if (pendingStatuses.includes(status)) {
        pendingCount += group.count;
      } else if (cancelledStatuses.includes(status)) {
        cancelledCount += group.count;
      } else {
        unmatchedCount += group.count;
        unmatchedGroups.push(group);
      }
    });

    console.log("\nDashboard Mapping Breakdown:");
    console.log(`- Completed Orders: ${completedCount}`);
    console.log(`- Pending Orders: ${pendingCount}`);
    console.log(`- Cancelled Orders: ${cancelledCount}`);
    console.log(`- Unmatched Orders (not mapped): ${unmatchedCount}`);
    
    if (unmatchedGroups.length > 0) {
      console.log("\nUnmatched Statuses details:");
      unmatchedGroups.forEach((g) => {
        console.log(`  - Status: "${g._id}", Count: ${g.count}`);
      });
    }

    console.log(`\nDashboard Sum (Completed + Pending + Cancelled): ${completedCount + pendingCount + cancelledCount}`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
