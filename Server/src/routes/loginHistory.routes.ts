import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getMyLoginHistoryHandler,
  getMyLoginStatsHandler,
  getAllLoginHistoryHandler,
} from '../controllers/loginHistory.controller';

const router = Router();

// User routes (authenticated users can see their own login history)
router.get('/me', authenticate(), getMyLoginHistoryHandler);
router.get('/me/stats', authenticate(), getMyLoginStatsHandler);

// Admin routes (only SUPER_ADMIN and ADMIN can see all login history)
router.get('/', authenticate(['SUPER_ADMIN', 'ADMIN']), getAllLoginHistoryHandler);

export const loginHistoryRoutes = router;

