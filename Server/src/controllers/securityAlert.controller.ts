/**
 * Security Alert Controller
 * 
 * Handles security alerts and notifications for admin panel
 */

import type { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import type { AuthenticatedRequest } from '../middleware/auth';
import { 
  getUnreadAlerts,
  getAllAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  dismissAlert,
  getUnreadAlertCount,
  getAlertStats
} from '../services/securityAlert.service';
import { SecurityAlertType, SecurityAlertSeverity } from '@prisma/client';
import { AppError } from '../utils/appError';

/**
 * Get unread alerts (admin only)
 * GET /api/v1/security-alerts/unread
 */
export const getUnreadAlertsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = await getUnreadAlerts(limit);

    return res.status(200).json(alerts);
  }
);

/**
 * Get all alerts with filters (admin only)
 * GET /api/v1/security-alerts
 */
export const getAllAlertsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;
    const isDismissed = req.query.isDismissed === 'true' ? true : req.query.isDismissed === 'false' ? false : undefined;
    const alertType = req.query.alertType as SecurityAlertType | undefined;
    const severity = req.query.severity as SecurityAlertSeverity | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const alerts = await getAllAlerts({
      isRead,
      isDismissed,
      alertType,
      severity,
      limit,
      startDate,
      endDate,
    });

    return res.status(200).json(alerts);
  }
);

/**
 * Mark an alert as read
 * POST /api/v1/security-alerts/:id/read
 */
export const markAlertAsReadHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const alertId = req.params.id;
    if (!alertId) {
      throw new AppError('Alert ID is required', 400);
    }

    const alert = await markAlertAsRead(alertId);

    return res.status(200).json(alert);
  }
);

/**
 * Mark all alerts as read
 * POST /api/v1/security-alerts/read-all
 */
export const markAllAlertsAsReadHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const count = await markAllAlertsAsRead();

    return res.status(200).json({
      message: `Marked ${count} alert(s) as read`,
      count,
    });
  }
);

/**
 * Dismiss an alert
 * POST /api/v1/security-alerts/:id/dismiss
 */
export const dismissAlertHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const alertId = req.params.id;
    if (!alertId) {
      throw new AppError('Alert ID is required', 400);
    }

    const alert = await dismissAlert(alertId);

    return res.status(200).json(alert);
  }
);

/**
 * Get unread alert count
 * GET /api/v1/security-alerts/unread/count
 */
export const getUnreadAlertCountHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const count = await getUnreadAlertCount();

    return res.status(200).json({ count });
  }
);

/**
 * Get alert statistics
 * GET /api/v1/security-alerts/stats
 */
export const getAlertStatsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const stats = await getAlertStats();

    return res.status(200).json(stats);
  }
);

