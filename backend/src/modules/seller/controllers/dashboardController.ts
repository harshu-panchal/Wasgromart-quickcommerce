import { Request, Response } from "express";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import OrderItem from "../../../models/OrderItem";
import { asyncHandler } from "../../../utils/asyncHandler";
import mongoose from "mongoose";
import { calculateOrderBreakdown } from "../../../services/commissionService";

/**
 * Get seller's dashboard statistics
 */
export const getDashboardStats = asyncHandler(
    async (req: Request, res: Response) => {
        const sellerId = new mongoose.Types.ObjectId((req as any).user.userId);

        // Find orders associated with this seller
        // Since Order model doesn't have sellerId, we find orders via OrderItem
        const sellerOrderItems = await OrderItem.find({ seller: sellerId }).select('order');
        const sellerOrderIds = [...new Set(sellerOrderItems.map(item => item.order.toString()))];

        // 1. KPI Metrics
        const [
            totalOrders,
            completedOrders,
            pendingOrders,
            cancelledOrders,
            totalProduct,
            distinctCategories,
            distinctSubcategories,
            totalCustomerCount,
        ] = await Promise.all([
            Order.countDocuments({ _id: { $in: sellerOrderIds } }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: "Delivered" }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: { $in: ["Received", "Accepted", "Pending", "Processed", "Shipped", "Out for Delivery", "Placed"] } }),
            Order.countDocuments({ _id: { $in: sellerOrderIds }, status: { $in: ["Cancelled", "Rejected", "Returned"] } }),
            Product.countDocuments({ seller: sellerId }),
            Product.distinct("category", { seller: sellerId }),
            Product.distinct("subcategory", { seller: sellerId }),
            Order.distinct("customer", { _id: { $in: sellerOrderIds } }).then(ids => ids.length),
        ]);

        // Process distinct category & subcategory IDs to count parent categories and subcategories
        const allCategoryIds = [...new Set([...distinctCategories, ...distinctSubcategories])].filter(id => id);
        const categoriesInDb = await Category.find({ _id: { $in: allCategoryIds } }).lean();

        // Subcategories are the ones with a parentId
        const subCategoryDocs = categoriesInDb.filter(c => c.parentId);
        const totalSubcategoryCount = subCategoryDocs.length;

        // Parent categories are directly referenced categories without a parentId, plus the parentId of subcategories
        const parentCategoryIds = new Set<string>();
        categoriesInDb.forEach(c => {
            if (c.parentId) {
                parentCategoryIds.add(c.parentId.toString());
            } else {
                parentCategoryIds.add(c._id.toString());
            }
        });
        const totalCategoryCount = parentCategoryIds.size;

        // 2. Alert Metrics (Low Stock < 5)
        // Check Product model usage
        const products = await Product.find({ seller: sellerId });
        let soldOutProducts = 0;
        let lowStockProducts = 0;

        products.forEach(product => {
            let isSoldOut = true;
            let isLowStock = false;

            if (product.variations && product.variations.length > 0) {
                product.variations.forEach(v => {
                    if ((v.stock || 0) > 0) isSoldOut = false;
                    if ((v.stock || 0) > 0 && (v.stock || 0) < 5) isLowStock = true;
                    if (v.stock && v.stock > 0) isSoldOut = false;
                    if (v.stock && v.stock > 0 && v.stock < 5) isLowStock = true;
                });
            } else {
                // Handle products without variations (fallback)
                if (product.stock > 0) isSoldOut = false;
                if (product.stock > 0 && product.stock < 5) isLowStock = true;
            }

            if (isSoldOut) soldOutProducts++;
            else if (isLowStock) lowStockProducts++;
        });

        // 3. New Orders Table (Latest 10)
        const newOrders = await Order.find({ _id: { $in: sellerOrderIds } })
            .sort({ createdAt: -1 })
            .limit(10);

        const formattedNewOrders = await Promise.all(newOrders.map(async (order) => {
            let sellerEarning = order.total;
            try {
                const breakdown = await calculateOrderBreakdown(order._id.toString());
                sellerEarning = breakdown.sellerEarnings.get(sellerId.toString()) || order.total;
            } catch (err) {
                console.error(`Error calculating earning for order ${order.orderNumber}:`, err);
            }

            return {
                id: order._id.toString(), // Use the ObjectId for routing
                orderId: order.orderNumber || order._id.toString(), // Provide orderNumber for display
                orderDate: new Date(order.orderDate).toLocaleDateString('en-GB'),
                status: order.status === 'Out for Delivery' ? 'Out For Delivery' : order.status,
                amount: sellerEarning, // Use net earning instead of grand total
            };
        }));

        // 4. Chart Data (Last 12 months)
        const currentYear = new Date().getFullYear();
        const monthlyStats = await Order.aggregate([
            {
                $match: {
                    _id: { $in: sellerOrderIds.map(id => new mongoose.Types.ObjectId(id)) },
                    orderDate: {
                        $gte: new Date(`${currentYear}-01-01`),
                        $lte: new Date(`${currentYear}-12-31`)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: "$orderDate" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const yearlyOrderData = months.map((month, index) => {
            const monthStat = monthlyStats.find(s => s._id === index + 1);
            return { date: month, value: monthStat ? monthStat.count : 0 };
        });

        // 5. Daily Chart Data (Current Month)
        const currentMonth = new Date().getMonth();
        const dailyStats = await Order.aggregate([
            {
                $match: {
                    _id: { $in: sellerOrderIds.map(id => new mongoose.Types.ObjectId(id)) },
                    orderDate: {
                        $gte: new Date(currentYear, currentMonth, 1),
                        $lte: new Date(currentYear, currentMonth + 1, 0)
                    }
                }
            },
            {
                $group: {
                    _id: { $dayOfMonth: "$orderDate" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dailyOrderData = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayStat = dailyStats.find(s => s._id === day);
            return { date: day.toString(), value: dayStat ? dayStat.count : 0 };
        });

        return res.status(200).json({
            success: true,
            message: "Dashboard stats fetched successfully",
            data: {
                stats: {
                    totalUser: totalCustomerCount,
                    totalCategory: totalCategoryCount,
                    totalSubcategory: totalSubcategoryCount,
                    totalProduct,
                    totalOrders,
                    completedOrders,
                    pendingOrders,
                    cancelledOrders,
                    soldOutProducts,
                    lowStockProducts,
                    yearlyOrderData,
                    dailyOrderData
                },
                newOrders: formattedNewOrders
            }
        });
    }
);
