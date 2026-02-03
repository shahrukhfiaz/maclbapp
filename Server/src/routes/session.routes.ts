import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createSessionHandler, deleteSessionHandler, listSessionsHandler, updateSessionHandler, getSessionAssignmentStatsHandler, getMySessionsHandler, getSharedSessionStatsHandler, markSharedSessionReadyHandler, requestSessionDownloadUrlHandler, requestSessionUploadUrlHandler, completeSessionUploadHandler, recordSessionEventHandler } from '../controllers/session.controller';

const router = Router();

// Public endpoint for users to get their own sessions (shared session)
router.get('/my-sessions', authenticate(), getMySessionsHandler);

// Public endpoint for shared session statistics
router.get('/shared-stats', authenticate(), getSharedSessionStatsHandler);

// Super admin endpoint to mark shared session as ready
router.post('/:sessionId/mark-ready', authenticate(['SUPER_ADMIN']), markSharedSessionReadyHandler);

// Session bundle endpoints (available to all authenticated users)
router.post('/:id/request-download', authenticate(), requestSessionDownloadUrlHandler);
router.post('/:id/request-upload', authenticate(), requestSessionUploadUrlHandler);
router.post('/:id/complete-upload', authenticate(), completeSessionUploadHandler);
router.post('/:id/events', authenticate(), recordSessionEventHandler);

// Admin-only endpoints
router.use(authenticate(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']));

router.get('/', listSessionsHandler);
router.post('/', createSessionHandler);
router.patch('/:id', updateSessionHandler);
router.delete('/:id', deleteSessionHandler);
router.get('/assignment-stats', getSessionAssignmentStatsHandler);

export const sessionRoutes = router;

