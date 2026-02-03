import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listAuditLogsHandler } from '../controllers/audit.controller';

const router = Router();

router.use(authenticate(['SUPER_ADMIN', 'ADMIN']));
router.get('/', listAuditLogsHandler);

export const auditRoutes = router;
