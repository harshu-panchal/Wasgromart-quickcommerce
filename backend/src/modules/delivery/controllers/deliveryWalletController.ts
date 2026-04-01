import { getCommissionSummary, processPendingCODPayouts } from '../../../services/commissionService';
import Delivery from '../../../models/Delivery';
import { createRazorpayOrder, verifyPaymentSignature } from '../../../services/paymentService';
import WalletTransaction from '../../../models/WalletTransaction';
import PlatformWallet from '../../../models/PlatformWallet';
import mongoose from 'mongoose';
import {
    getWalletBalance,
    getWalletTransactions,
    createWithdrawalRequest,
    getWithdrawalRequests,
} from '../../../services/walletManagementService';

/**
 * Get delivery boy wallet balance
 */
export const getBalance = async (req: Request, res: Response) => {
    try {
        const deliveryBoyId = req.user!.userId;
        const balance = await getWalletBalance(deliveryBoyId, 'DELIVERY_BOY');
        const deliveryBoy = await Delivery.findById(deliveryBoyId).select('pendingAdminPayout cashCollected');

        return res.status(200).json({
            success: true,
            data: {
                balance,
                pendingAdminPayout: deliveryBoy?.pendingAdminPayout || 0,
                cashCollected: deliveryBoy?.cashCollected || 0
            },
        });
    } catch (error: any) {
        console.error('Error getting wallet balance:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get wallet balance',
        });
    }
};

/**
 * Get delivery boy wallet transactions
 */
export const getTransactions = async (req: Request, res: Response) => {
    try {
        const deliveryBoyId = req.user!.userId;
        const { page = 1, limit = 20 } = req.query;

        const result = await getWalletTransactions(
            deliveryBoyId,
            'DELIVERY_BOY',
            Number(page),
            Number(limit)
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting wallet transactions:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get wallet transactions',
        });
    }
};

/**
 * Request withdrawal
 */
export const requestWithdrawal = async (req: Request, res: Response) => {
    try {
        const deliveryBoyId = req.user!.userId;
        const { amount, paymentMethod } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid withdrawal amount',
            });
        }

        if (!paymentMethod || !['Bank Transfer', 'UPI'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method',
            });
        }

        const result = await createWithdrawalRequest(
            deliveryBoyId,
            'DELIVERY_BOY',
            amount,
            paymentMethod
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error: any) {
        console.error('Error requesting withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to request withdrawal',
        });
    }
};

/**
 * Get delivery boy withdrawal requests
 */
export const getWithdrawals = async (req: Request, res: Response) => {
    try {
        const deliveryBoyId = req.user!.userId;
        const { status } = req.query;

        const result = await getWithdrawalRequests(
            deliveryBoyId,
            'DELIVERY_BOY',
            status as string
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting withdrawal requests:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get withdrawal requests',
        });
    }
};

/**
 * Get delivery boy commission earnings
 */
export const getCommissions = async (req: Request, res: Response) => {
    try {
        const deliveryBoyId = req.user!.userId;

        const result = await getCommissionSummary(deliveryBoyId, 'DELIVERY_BOY');

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting commission earnings:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get commission earnings',
        });
    }
};

/**
 * Create Admin Payout Order (Razorpay)
 */
export const createAdminPayoutOrder = async (req: Request, res: Response) => {
    try {
        const deliveryBoyId = req.user!.userId;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        const deliveryBoy = await Delivery.findById(deliveryBoyId);
        if (!deliveryBoy) {
            return res.status(404).json({ success: false, message: "Delivery boy not found" });
        }

        // Add a small epsilon for float comparison safety
        if (amount > (deliveryBoy.pendingAdminPayout || 0) + 0.01) {
            return res.status(400).json({
                success: false,
                message: `Amount exceeds pending admin payout of ₹${deliveryBoy.pendingAdminPayout || 0}`
            });
        }

        const receipt = `PAYOUT-${Date.now()}`;
        const result = await createRazorpayOrder(receipt, amount);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error("Error creating admin payout order:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verify Admin Payout (Razorpay)
 */
export const verifyAdminPayout = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const deliveryBoyId = req.user!.userId;
        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            amount
        } = req.body;

        // 1. Verify Signature
        const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            throw new Error("Invalid payment signature");
        }

        // 2. Update delivery boy pendingAdminPayout
        const deliveryBoy = await Delivery.findById(deliveryBoyId).session(session);
        if (!deliveryBoy) {
            throw new Error("Delivery boy not found");
        }

        // Round pending payout for comparison
        const currentPending = Math.round((deliveryBoy.pendingAdminPayout || 0) * 100) / 100;

        // Validate amount doesn't significantly exceed pending
        if (amount > currentPending + 0.01) {
            throw new Error(`Payment amount (₹${amount}) exceeds pending admin payout (₹${currentPending})`);
        }

        // Record transaction first
        const reference = `PAYOUT-${razorpayPaymentId}`;
        const transaction = new WalletTransaction({
            userId: deliveryBoyId,
            userType: "DELIVERY_BOY",
            amount: amount,
            type: "Debit",
            description: "Payout to Admin via Razorpay",
            status: "Completed",
            reference,
        });
        await transaction.save({ session });

        // Update Platform Wallet
        const platformWallet = await PlatformWallet.findOne().session(session);
        if (platformWallet) {
            platformWallet.totalPlatformEarning += amount;
            platformWallet.currentPlatformBalance += amount;
            platformWallet.pendingFromDeliveryBoy = Math.max(0, platformWallet.pendingFromDeliveryBoy - amount);
            await platformWallet.save({ session });
        }

        // 3. Distribute funds to sellers (process pending COD payouts)
        await processPendingCODPayouts(deliveryBoyId, amount, session);

        // Update delivery boy pending amount
        deliveryBoy.pendingAdminPayout = Math.max(0, currentPending - amount);
        await deliveryBoy.save({ session });

        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Admin payout verified and processed successfully"
        });
    } catch (error: any) {
        await session.abortTransaction();
        console.error("Error verifying admin payout:", error);
        return res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};
