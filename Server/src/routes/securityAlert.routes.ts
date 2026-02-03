import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getUnreadAlertsHandler,
  getAllAlertsHandler,
  markAlertAsReadHandler,
  markAllAlertsAsReadHandler,
  dismissAlertHandler,
  getUnreadAlertCountHandler,
  getAlertStatsHandler,
} from '../controllers/securityAlert.controller';

const router = Router();

// All routes require SUPER_ADMIN or ADMIN access
router.get('/unread', authenticate(['SUPER_ADMIN', 'ADMIN']), getUnreadAlertsHandler);
router.get('/unread/count', authenticate(['SUPER_ADMIN', 'ADMIN']), getUnreadAlertCountHandler);
router.get('/stats', authenticate(['SUPER_ADMIN', 'ADMIN']), getAlertStatsHandler);
router.get('/', authenticate(['SUPER_ADMIN', 'ADMIN']), getAllAlertsHandler);
router.post('/:id/read', authenticate(['SUPER_ADMIN', 'ADMIN']), markAlertAsReadHandler);
router.post('/read-all', authenticate(['SUPER_ADMIN', 'ADMIN']), markAllAlertsAsReadHandler);
router.post('/:id/dismiss', authenticate(['SUPER_ADMIN', 'ADMIN']), dismissAlertHandler);

export const securityAlertRoutes = router;

