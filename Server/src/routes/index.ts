import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { userRoutes } from './user.routes';
import { domainRoutes } from './domain.routes';
import { sessionRoutes } from './session.routes';
import { auditRoutes } from './audit.routes';
import { loginHistoryRoutes } from './loginHistory.routes';
import { sessionActivityRoutes } from './sessionActivity.routes';
import { securityAlertRoutes } from './securityAlert.routes';

const router = Router();

// API health check
router.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    api: 'v1'
  });
});

// Register all routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/domains', domainRoutes);
router.use('/sessions', sessionRoutes);
router.use('/audits', auditRoutes);
router.use('/login-history', loginHistoryRoutes);
router.use('/session-activity', sessionActivityRoutes);
router.use('/security-alerts', securityAlertRoutes);

export default router;
