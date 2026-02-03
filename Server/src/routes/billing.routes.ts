import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  startBillingCycleHandler,
  addPaymentHandler,
  getUserBillingStatusHandler,
  getPaymentHistoryHandler,
  getBillingHistoryHandler,
  setTrialPeriodHandler,
  getExpiredAccountsHandler,
  checkExpiredAccountsHandler,
} from '../controllers/billing.controller';

const router = Router();

// All billing routes require authentication and admin role
router.use(authenticate(['SUPER_ADMIN', 'ADMIN']));

// User-specific billing operations
router.post('/:userId/start-cycle', startBillingCycleHandler);
router.post('/:userId/add-payment', addPaymentHandler);
router.get('/:userId/status', getUserBillingStatusHandler);
router.get('/:userId/payments', getPaymentHistoryHandler);
router.get('/:userId/history', getBillingHistoryHandler);
router.post('/:userId/set-trial', setTrialPeriodHandler);

// Admin-only operations
router.get('/expired', getExpiredAccountsHandler);
router.post('/check-expired', checkExpiredAccountsHandler);

export default router;

