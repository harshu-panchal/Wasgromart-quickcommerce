import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Commission from "../../../models/Commission";
import mongoose from "mongoose";

/**
 * Get Earnings History
 * Groups actual delivery-boy commissions (paid) by day for the last 30 days.
 */
export const getEarningsHistory = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const objectId = new mongoose.Types.ObjectId(deliveryId);

    const earnings = await Commission.aggregate([
        {
            $match: {
                deliveryBoy: objectId,
                type: "DELIVERY_BOY",
                status: "Paid",
                paidAt: { $exists: true }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$paidAt" }
                },
                amount: { $sum: "$commissionAmount" },
                deliveries: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } },
        { $limit: 30 }
    ]);

    const formattedEarnings = earnings.map(day => {
        // Humanize date labels like "Today", "Yesterday"
        const date = new Date(day._id);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateLabel = day._id;
        if (date.toDateString() === today.toDateString()) dateLabel = "Today";
        else if (date.toDateString() === yesterday.toDateString()) dateLabel = "Yesterday";
        else {
            // Calculate "X days ago" if needed or leave date string
            const diffTime = Math.abs(today.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) dateLabel = `${diffDays} days ago`;
        }

        return {
            date: dateLabel,
            rawDate: day._id, // Keep raw date for sorting/logic if needed
            amount: Math.round((day.amount || 0) * 100) / 100,
            deliveries: day.deliveries
        };
    });

    return res.status(200).json({
        success: true,
        data: formattedEarnings
    });
});
