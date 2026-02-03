/**
 * Session Activity Controller
 * 
 * Handles active session management and monitoring
 */

import type { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import type { AuthenticatedRequest } from '../middleware/auth';
import { 
  getActiveSessions,
  getUserActiveSessions,
  getUserSessionHistory,
  forceLogout,
  getSessionStats,
  invalidateAllUserSessions
} from '../services/sessionActivity.service';
import { AppError } from '../utils/appError';

/**
 * Get all active sessions (admin only)
 * GET /api/v1/sessions/active
 */
export const getAllActiveSessionsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const sessions = await getActiveSessions(limit);

    return res.status(200).json(sessions);
  }
);

/**
 * Get current user's active session
 * GET /api/v1/sessions/active/me
 */
export const getMyActiveSessionHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const sessions = await getUserActiveSessions(req.user.id);

    return res.status(200).json(sessions);
  }
);

/**
 * Get current user's session history
 * GET /api/v1/sessions/history/me
 */
export const getMySessionHistoryHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const history = await getUserSessionHistory(req.user.id, limit);

    return res.status(200).json(history);
  }
);

/**
 * Force logout a specific session (admin only)
 * POST /api/v1/sessions/:id/logout
 */
export const forceLogoutSessionHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const sessionId = req.params.id;
    if (!sessionId) {
      throw new AppError('Session ID is required', 400);
    }

    const result = await forceLogout(sessionId, req.user.id);

    return res.status(200).json({
      message: `User ${result.userEmail} has been logged out`,
      ...result,
    });
  }
);

/**
 * Logout all sessions for a user (admin only)
 * POST /api/v1/sessions/logout-all/:userId
 */
export const logoutAllUserSessionsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.params.userId;
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }

    const count = await invalidateAllUserSessions(userId, 'forced_by_admin');

    return res.status(200).json({
      message: `Logged out ${count} session(s) for user`,
      count,
    });
  }
);

/**
 * Get session statistics (admin only)
 * GET /api/v1/sessions/stats
 */
export const getSessionStatsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const stats = await getSessionStats();

    return res.status(200).json(stats);
  }
);

