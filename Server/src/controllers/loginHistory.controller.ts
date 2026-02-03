/**
 * Login History Controller
 * 
 * Handles login history retrieval for users and admins
 */

import type { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import type { AuthenticatedRequest } from '../middleware/auth';
import { 
  getUserLoginHistory, 
  getAllLoginHistory,
  getUserLoginStats 
} from '../services/loginHistory.service';

/**
 * Get current user's login history
 * GET /api/v1/login-history/me
 */
export const getMyLoginHistoryHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const history = await getUserLoginHistory(req.user.id, limit);

    return res.status(200).json(history);
  }
);

/**
 * Get current user's login statistics
 * GET /api/v1/login-history/me/stats
 */
export const getMyLoginStatsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const stats = await getUserLoginStats(req.user.id);

    return res.status(200).json(stats);
  }
);

/**
 * Get all login history (admin only)
 * GET /api/v1/login-history
 */
export const getAllLoginHistoryHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const userId = req.query.userId as string | undefined;
    const success = req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined;
    
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const history = await getAllLoginHistory(limit, {
      userId,
      success,
      startDate,
      endDate,
    });

    return res.status(200).json(history);
  }
);

