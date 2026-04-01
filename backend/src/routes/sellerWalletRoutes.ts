import { Router } from 'express';
import * as walletController from '../modules/seller/controllers/sellerWalletController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireUserType('Seller'));

router.get('/balance', walletController.getBalance);
router.get('/transactions', walletController.getTransactions);
router.post('/withdraw', walletController.requestWithdrawal);
router.get('/withdrawals', walletController.getWithdrawals);
router.get('/commissions', walletController.getCommissions);

export default router;
