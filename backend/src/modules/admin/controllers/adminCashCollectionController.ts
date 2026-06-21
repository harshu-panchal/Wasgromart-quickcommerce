import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import CashCollection from "../../../models/CashCollection";
import Delivery from "../../../models/Delivery";
import Order from "../../../models/Order";

/**
 * Get all cash collections
 */
export const getCashCollections = asyncHandler(
    async (req: Request, res: Response) => {
        const {
            page = 1,
            limit = 10,
            deliveryBoyId,
            fromDate,
            toDate,
            search = "",
            sortBy = "collectedAt",
            sortOrder = "desc",
        } = req.query;

        const query: any = {};

        // Filter by delivery boy
        if (deliveryBoyId) {
            query.deliveryBoy = deliveryBoyId;
        }

        // Date range filter
        if (fromDate || toDate) {
            query.collectedAt = {};
            if (fromDate) {
                query.collectedAt.$gte = new Date(fromDate as string);
            }
            if (toDate) {
                query.collectedAt.$lte = new Date(toDate as string);
            }
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        const sort: any = {};
        sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

        // Filter by search
        if (search) {
            const searchRegex = new RegExp(search as string, 'i');
            
            // Find matching delivery boys
            const matchingDeliveryBoys = await Delivery.find({
                name: searchRegex
            }).select('_id');
            const deliveryBoyIds = matchingDeliveryBoys.map(d => d._id);

            // Find matching orders
            const matchingOrders = await Order.find({
                orderNumber: searchRegex
            }).select('_id');
            const orderIds = matchingOrders.map(o => o._id);

            query.$or = [
                { deliveryBoy: { $in: deliveryBoyIds } },
                { order: { $in: orderIds } }
            ];
            
            // If they search by amount or remark
            if (!isNaN(Number(search))) {
                query.$or.push({ amount: Number(search) });
            }
        }

        const [collections, total] = await Promise.all([
            CashCollection.find(query)
                .populate("deliveryBoy", "name mobile")
                .populate("order", "orderNumber total")
                .populate("collectedBy", "name")
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit as string)),
            CashCollection.countDocuments(query),
        ]);

        // Transform data to match frontend expectations
        const transformedCollections = collections.map((collection: any) => ({
            _id: collection._id,
            deliveryBoyId: collection.deliveryBoy?._id,
            deliveryBoyName: collection.deliveryBoy?.name || "Unknown",
            orderId: collection.order?.orderNumber || collection.order?._id,
            total: collection.order?.total || 0,
            amount: collection.amount,
            remark: collection.remark,
            collectedAt: collection.collectedAt,
            collectedBy: collection.collectedBy?.name || "Unknown",
        }));

        return res.status(200).json({
            success: true,
            message: "Cash collections fetched successfully",
            data: transformedCollections,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    }
);

/**
 * Get cash collection by ID
 */
export const getCashCollectionById = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const collection = await CashCollection.findById(id)
            .populate("deliveryBoy", "name mobile")
            .populate("order", "orderNumber total")
            .populate("collectedBy", "name");

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: "Cash collection not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cash collection fetched successfully",
            data: collection,
        });
    }
);

/**
 * Create cash collection
 */
export const createCashCollection = asyncHandler(
    async (req: Request, res: Response) => {
        const { deliveryBoyId, orderId, orderNumber, amount, remark } = req.body;

        if (!deliveryBoyId || (!orderId && !orderNumber) || amount === undefined) {
            return res.status(400).json({
                success: false,
                message: "Delivery boy ID, order ID/Number, and amount are required",
            });
        }

        // Verify delivery boy exists
        const deliveryBoy = await Delivery.findById(deliveryBoyId);
        if (!deliveryBoy) {
            return res.status(404).json({
                success: false,
                message: "Delivery boy not found",
            });
        }

        // Verify order exists
        let order;
        if (orderNumber) {
            order = await Order.findOne({ orderNumber });
        } else if (orderId) {
            order = await Order.findById(orderId);
        }
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Create cash collection
        const collection = await CashCollection.create({
            deliveryBoy: deliveryBoyId,
            order: order._id,
            amount,
            remark,
            collectedBy: req.user?.userId,
            collectedAt: new Date(),
        });

        // Update delivery boy's cash collected
        deliveryBoy.cashCollected = (deliveryBoy.cashCollected || 0) - amount;
        await deliveryBoy.save();

        const populatedCollection = await CashCollection.findById(collection._id)
            .populate("deliveryBoy", "name mobile")
            .populate("order", "orderNumber total")
            .populate("collectedBy", "name");

        return res.status(201).json({
            success: true,
            message: "Cash collection created successfully",
            data: populatedCollection,
        });
    }
);

/**
 * Update cash collection
 */
export const updateCashCollection = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { amount, remark } = req.body;

        const collection = await CashCollection.findById(id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: "Cash collection not found",
            });
        }

        // If amount is being updated, adjust delivery boy's cash collected
        if (amount !== undefined && amount !== collection.amount) {
            const deliveryBoy = await Delivery.findById(collection.deliveryBoy);
            if (deliveryBoy) {
                const difference = collection.amount - amount;
                deliveryBoy.cashCollected =
                    (deliveryBoy.cashCollected || 0) + difference;
                await deliveryBoy.save();
            }
            collection.amount = amount;
        }

        if (remark !== undefined) {
            collection.remark = remark;
        }

        await collection.save();

        const updatedCollection = await CashCollection.findById(id)
            .populate("deliveryBoy", "name mobile")
            .populate("order", "orderNumber total")
            .populate("collectedBy", "name");

        return res.status(200).json({
            success: true,
            message: "Cash collection updated successfully",
            data: updatedCollection,
        });
    }
);

/**
 * Delete cash collection
 */
export const deleteCashCollection = asyncHandler(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const collection = await CashCollection.findById(id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: "Cash collection not found",
            });
        }

        // Restore the amount to delivery boy's cash collected
        const deliveryBoy = await Delivery.findById(collection.deliveryBoy);
        if (deliveryBoy) {
            deliveryBoy.cashCollected =
                (deliveryBoy.cashCollected || 0) + collection.amount;
            await deliveryBoy.save();
        }

        await CashCollection.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Cash collection deleted successfully",
        });
    }
);
