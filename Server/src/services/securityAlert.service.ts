/**
 * Security Alert Service
 * 
 * Manages security alerts and notifications for admin panel
 */

import { prisma } from '../db/client';
import { SecurityAlertType, SecurityAlertSeverity } from '@prisma/client';

export interface CreateAlertParams {
  userId?: string;
  alertType: SecurityAlertType;
  severity: SecurityAlertSeverity;
  message: string;
  metadata?: any;
}

/**
 * Create a security alert
 */
export async function createSecurityAlert(params: CreateAlertParams) {
  const alert = await prisma.securityAlert.create({
    data: {
      userId: params.userId,
      alertType: params.alertType,
      severity: params.severity,
      message: params.message,
      metadata: params.metadata || {},
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return alert;
}

/**
 * Create a multiple device login alert
 */
export async function createMultipleDeviceLoginAlert(params: {
  userId: string;
  userEmail: string;
  previousDevice: string | null;
  previousIP: string | null;
  previousLocation: string | null;
  newDevice: string;
  newIP: string;
  newLocation: string | null;
}) {
  const previousInfo = params.previousDevice && params.previousIP 
    ? `Previous session on ${params.previousDevice} (${params.previousIP}) was terminated.`
    : 'No previous session found.';
  const message = `${params.userEmail} logged in from a new device. ${previousInfo}`;

  return createSecurityAlert({
    userId: params.userId,
    alertType: 'MULTIPLE_DEVICE_LOGIN',
    severity: 'MEDIUM',
    message,
    metadata: {
      email: params.userEmail,
      previousDevice: params.previousDevice,
      previousIP: params.previousIP,
      previousLocation: params.previousLocation,
      newDevice: params.newDevice,
      newIP: params.newIP,
      newLocation: params.newLocation,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Create a suspicious location alert
 */
export async function createSuspiciousLocationAlert(params: {
  userId: string;
  userEmail: string;
  previousLocation: string;
  newLocation: string;
  distance: number;
  timeDiff: number;
}) {
  const message = `Suspicious location change detected for ${params.userEmail}. Traveled ${params.distance.toFixed(0)} km in ${params.timeDiff} minutes.`;

  return createSecurityAlert({
    userId: params.userId,
    alertType: 'SUSPICIOUS_LOCATION',
    severity: 'HIGH',
    message,
    metadata: {
      email: params.userEmail,
      previousLocation: params.previousLocation,
      newLocation: params.newLocation,
      distanceKm: params.distance,
      timeMinutes: params.timeDiff,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Create a failed login attempt alert
 */
export async function createFailedLoginAlert(params: {
  email: string;
  ipAddress: string;
  location: string | null;
  attemptCount: number;
  reason: string;
}) {
  const severity: SecurityAlertSeverity = params.attemptCount >= 5 ? 'HIGH' : 'MEDIUM';
  const message = `${params.attemptCount} failed login attempt(s) for ${params.email} from ${params.ipAddress} (${params.location || 'Unknown location'})`;

  return createSecurityAlert({
    alertType: 'FAILED_LOGIN_ATTEMPT',
    severity,
    message,
    metadata: {
      email: params.email,
      ipAddress: params.ipAddress,
      location: params.location,
      attemptCount: params.attemptCount,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Get unread alerts
 */
export async function getUnreadAlerts(limit: number = 50) {
  const alerts = await prisma.securityAlert.findMany({
    where: {
      isRead: false,
      isDismissed: false,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return alerts;
}

/**
 * Get all alerts with filters
 */
export async function getAllAlerts(params?: {
  isRead?: boolean;
  isDismissed?: boolean;
  alertType?: SecurityAlertType;
  severity?: SecurityAlertSeverity;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: any = {};

  if (params?.isRead !== undefined) {
    where.isRead = params.isRead;
  }

  if (params?.isDismissed !== undefined) {
    where.isDismissed = params.isDismissed;
  }

  if (params?.alertType) {
    where.alertType = params.alertType;
  }

  if (params?.severity) {
    where.severity = params.severity;
  }

  if (params?.startDate || params?.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = params.startDate;
    }
    if (params.endDate) {
      where.createdAt.lte = params.endDate;
    }
  }

  const alerts = await prisma.securityAlert.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: params?.limit || 100,
  });

  return alerts;
}

/**
 * Mark an alert as read
 */
export async function markAlertAsRead(alertId: string) {
  const alert = await prisma.securityAlert.update({
    where: { id: alertId },
    data: { isRead: true },
  });

  return alert;
}

/**
 * Mark multiple alerts as read
 */
export async function markAllAlertsAsRead() {
  const updated = await prisma.securityAlert.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });

  return updated.count;
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(alertId: string) {
  const alert = await prisma.securityAlert.update({
    where: { id: alertId },
    data: { isDismissed: true },
  });

  return alert;
}

/**
 * Get unread alert count
 */
export async function getUnreadAlertCount() {
  const count = await prisma.securityAlert.count({
    where: {
      isRead: false,
      isDismissed: false,
    },
  });

  return count;
}

/**
 * Get alert statistics
 */
export async function getAlertStats() {
  const total = await prisma.securityAlert.count();
  const unread = await prisma.securityAlert.count({ where: { isRead: false } });
  const today = await prisma.securityAlert.count({
    where: {
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  const bySeverity = await prisma.securityAlert.groupBy({
    by: ['severity'],
    _count: true,
    where: {
      isRead: false,
      isDismissed: false,
    },
  });

  const byType = await prisma.securityAlert.groupBy({
    by: ['alertType'],
    _count: true,
    where: {
      isRead: false,
      isDismissed: false,
    },
  });

  return {
    total,
    unread,
    today,
    bySeverity: bySeverity.reduce((acc, item) => {
      acc[item.severity] = item._count;
      return acc;
    }, {} as Record<string, number>),
    byType: byType.reduce((acc, item) => {
      acc[item.alertType] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Clean up old dismissed alerts
 */
export async function cleanupOldAlerts(daysOld: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.securityAlert.deleteMany({
    where: {
      isDismissed: true,
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return deleted.count;
}

