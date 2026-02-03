import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAllActiveSessionsHandler,
  getMyActiveSessionHandler,
  getMySessionHistoryHandler,
  forceLogoutSessionHandler,
  logoutAllUserSessionsHandler,
  getSessionStatsHandler,
} from '../controllers/sessionActivity.controller';

const router = Router();

// User routes (authenticated users can see their own sessions)
router.get('/active/me', authenticate(), getMyActiveSessionHandler);
router.get('/history/me', authenticate(), getMySessionHistoryHandler);

// Admin routes (only SUPER_ADMIN and ADMIN can manage all sessions)
router.get('/active', authenticate(['SUPER_ADMIN', 'ADMIN']), getAllActiveSessionsHandler);
router.get('/stats', authenticate(['SUPER_ADMIN', 'ADMIN']), getSessionStatsHandler);
router.post('/:id/logout', authenticate(['SUPER_ADMIN', 'ADMIN']), forceLogoutSessionHandler);
router.post('/logout-all/:userId', authenticate(['SUPER_ADMIN', 'ADMIN']), logoutAllUserSessionsHandler);

export const sessionActivityRoutes = router;

