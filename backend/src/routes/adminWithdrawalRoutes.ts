import { Router } from 'express';
import * as withdrawalController from '../modules/admin/controllers/adminWithdrawalController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireUserType('Admin'));

router.get('/withdrawals', withdrawalController.getAllWithdrawals);
router.patch('/withdrawals/:id/approve', withdrawalController.approveWithdrawal);
router.patch('/withdrawals/:id/reject', withdrawalController.rejectWithdrawal);
router.patch('/withdrawals/:id/complete', withdrawalController.completeWithdrawal);

export default router;
