import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Commission from '../../../models/Commission';
import WalletTransaction from '../../../models/WalletTransaction';
import WithdrawRequest from '../../../models/WithdrawRequest';
import PlatformWallet from '../../../models/PlatformWallet';
import { asyncHandler } from '../../../utils/asyncHandler';
import { approveWithdrawal, rejectWithdrawal, completeWithdrawal } from './adminWithdrawalController';

/**
 * Get Financial Dashboard Stats
 */
export const getFinancialDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const wallet = await PlatformWallet.getWallet();

  // We still calculate some things on the fly or just use wallet
  // It's better to use wallet for consistency with our new sync logic

  return res.status(200).json({
    success: true,
    data: {
      totalGMV: wallet.totalPlatformEarning,
      currentAccountBalance: wallet.currentPlatformBalance,
      totalAdminEarnings: wallet.totalAdminEarning,
      sellerPendingPayouts: wallet.sellerPendingPayouts,
      deliveryPendingPayouts: wallet.deliveryBoyPendingPayouts,
      pendingFromDeliveryBoy: wallet.pendingFromDeliveryBoy,
      pendingWithdrawalsCount: await WithdrawRequest.countDocuments({ status: 'Pending' })
    }
  });
});

/**
 * Get Admin Earnings (Commissions List)
 */
export const getAdminEarnings = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;

  const query: any = {};
  if (status) query.status = status;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
    if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const earnings = await Commission.find(query)
    .populate('order', 'orderNumber')
    .populate('seller', 'storeName sellerName')
    .populate('deliveryBoy', 'name mobile')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Commission.countDocuments(query);

  // Format data for frontend
  const formattedEarnings = earnings.map(e => {
    let sourceName = 'Unknown';
    if (e.type === 'SELLER' && e.seller) {
      sourceName = (e.seller as any).storeName || (e.seller as any).sellerName;
    } else if (e.type === 'DELIVERY_BOY' && e.deliveryBoy) {
      sourceName = (e.deliveryBoy as any).name;
    }

    return {
      id: e._id,
      source: sourceName,
      sourceType: e.type,
      amount: e.commissionAmount,
      date: e.createdAt,
      status: e.status,
      description: `Order #${(e.order as any)?.orderNumber || 'Unknown'}`,
      orderId: (e.order as any)?._id
    };
  });

  return res.status(200).json({
    success: true,
    data: formattedEarnings,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
});

/**
 * Get All Wallet Transactions (Sellers & Delivery Boys)
 */
/**
 * Get All Wallet Transactions (Sellers & Delivery Boys)
 */
export const getWalletTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, type, userType, search: _search } = req.query;

  const query: any = {};
  if (type) query.type = type;
  if (userType) query.userType = userType;

  // Search handling not fully implemented for cross-collection ref

  const skip = (Number(page) - 1) * Number(limit);

  // Fetch transactions without populate first, as refPath 'userType' values (SELLER/DELIVERY_BOY) 
  // do not match Model names (Seller/Delivery)
  const transactions = await WalletTransaction.find(query)
    .populate('relatedOrder', 'orderNumber')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await WalletTransaction.countDocuments(query);

  // Manually populate user details
  const sellerIds: any[] = [];
  const deliveryIds: any[] = [];

  transactions.forEach(t => {
    if (t.userType === 'SELLER') sellerIds.push(t.userId);
    else if (t.userType === 'DELIVERY_BOY') deliveryIds.push(t.userId);
  });

  const [sellers, deliveryBoys] = await Promise.all([
    mongoose.model('Seller').find({ _id: { $in: sellerIds } }).select('storeName sellerName mobile email'),
    mongoose.model('Delivery').find({ _id: { $in: deliveryIds } }).select('name firstName lastName mobile email')
  ]);

  const sellerMap = new Map(sellers.map(s => [s._id.toString(), s]));
  const deliveryMap = new Map(deliveryBoys.map(d => [d._id.toString(), d]));

  // Format transactions
  const formattedTransactions = transactions.map((t: any) => {
    let userName = 'Unknown';
    let user: any = null;

    if (t.userType === 'SELLER') {
      user = sellerMap.get(t.userId.toString());
      if (user) {
        userName = user.storeName || user.sellerName;
      }
    } else if (t.userType === 'DELIVERY_BOY') {
      user = deliveryMap.get(t.userId.toString());
      if (user) {
        userName = user.name || (user.firstName ? user.firstName + (user.lastName ? ' ' + user.lastName : '') : 'Delivery Partner');
      }
    }

    return {
      _id: t._id,
      type: t.type,
      userType: t.userType,
      userName: userName,
      userId: user, // Return full user object or just ID based on frontend need, ensuring compatibility
      amount: t.amount,
      description: t.description,
      status: t.status,
      createdAt: t.createdAt,
      reference: t.reference,
      relatedOrder: t.relatedOrder ? { orderNumber: t.relatedOrder.orderNumber } : undefined
    };
  });

  return res.status(200).json({
    success: true,
    data: formattedTransactions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
});

/**
 * Process Withdrawal Wrapper (to match frontend service expectation)
 */
export const processWithdrawalWrapper = asyncHandler(async (req: Request, res: Response) => {
  const { requestId, action, remark, transactionReference } = req.body;

  if (!requestId || !action) {
    return res.status(400).json({
      success: false,
      message: 'Request ID and action are required'
    });
  }

  // Mock the params for the existing controllers
  req.params.id = requestId;

  if (action === 'Approve') {
    return approveWithdrawal(req, res);
  } else if (action === 'Reject') {
    req.body.remarks = remark; // Map 'remark' to 'remarks'
    return rejectWithdrawal(req, res);
  } else if (action === 'Complete') {
    if (!transactionReference) {
      return res.status(400).json({
        success: false,
        message: 'Transaction reference is required for completion'
      });
    }
    req.body.transactionReference = transactionReference;
    return completeWithdrawal(req, res);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be "Approve", "Reject", or "Complete"'
    });
  }
});
