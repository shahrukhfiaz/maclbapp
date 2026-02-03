/**
 * Login History Service
 * 
 * Manages login attempt tracking and history retrieval
 */

import { prisma } from '../db/client';
import { getLocationFromIP, LocationData } from '../utils/geolocation';
import { parseDeviceInfo, getDeviceFingerprint } from '../utils/deviceFingerprint';

export interface CreateLoginHistoryParams {
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  macAddress?: string;
  deviceMetadata?: any;
  success: boolean;
  failureReason?: string;
}

/**
 * Create a login history record
 */
export async function createLoginHistory(params: CreateLoginHistoryParams) {
  // Get location from IP
  let locationData: LocationData | null = null;
  if (params.ipAddress) {
    locationData = await getLocationFromIP(params.ipAddress);
  }

  // Parse device info from User-Agent
  const deviceInfo = parseDeviceInfo(params.userAgent);
  const deviceFingerprint = getDeviceFingerprint(deviceInfo);

  // Create the record
  const loginHistory = await prisma.loginHistory.create({
    data: {
      userId: params.userId,
      email: params.email,
      ipAddress: params.ipAddress,
      location: locationData?.location,
      city: locationData?.city,
      country: locationData?.country,
      latitude: locationData?.latitude,
      longitude: locationData?.longitude,
      macAddress: params.macAddress,
      deviceInfo: deviceFingerprint,
      userAgent: params.userAgent,
      success: params.success,
      failureReason: params.failureReason,
    },
  });

  return loginHistory;
}

/**
 * Get login history for a specific user
 */
export async function getUserLoginHistory(userId: string, limit: number = 50) {
  const history = await prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { loginAt: 'desc' },
    take: limit,
  });

  return history;
}

/**
 * Get all login history (admin only)
 */
export async function getAllLoginHistory(
  limit: number = 100,
  filters?: {
    userId?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const where: any = {};

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  if (filters?.success !== undefined) {
    where.success = filters.success;
  }

  if (filters?.startDate || filters?.endDate) {
    where.loginAt = {};
    if (filters.startDate) {
      where.loginAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.loginAt.lte = filters.endDate;
    }
  }

  const history = await prisma.loginHistory.findMany({
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
    orderBy: { loginAt: 'desc' },
    take: limit,
  });

  return history;
}

/**
 * Get failed login attempts for a user (security monitoring)
 */
export async function getFailedLoginAttempts(
  userId: string,
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
) {
  const failedAttempts = await prisma.loginHistory.findMany({
    where: {
      userId,
      success: false,
      loginAt: {
        gte: since,
      },
    },
    orderBy: { loginAt: 'desc' },
  });

  return failedAttempts;
}

/**
 * Get login statistics for a user
 */
export async function getUserLoginStats(userId: string) {
  const totalLogins = await prisma.loginHistory.count({
    where: { userId, success: true },
  });

  const failedLogins = await prisma.loginHistory.count({
    where: { userId, success: false },
  });

  const lastLogin = await prisma.loginHistory.findFirst({
    where: { userId, success: true },
    orderBy: { loginAt: 'desc' },
  });

  const uniqueIPs = await prisma.loginHistory.findMany({
    where: { userId, success: true },
    select: { ipAddress: true },
    distinct: ['ipAddress'],
  });

  const uniqueLocations = await prisma.loginHistory.findMany({
    where: { userId, success: true, location: { not: null } },
    select: { location: true },
    distinct: ['location'],
  });

  return {
    totalLogins,
    failedLogins,
    successRate: totalLogins > 0 ? ((totalLogins / (totalLogins + failedLogins)) * 100).toFixed(2) : '0',
    lastLogin: lastLogin?.loginAt,
    lastLocation: lastLogin?.location,
    uniqueIPCount: uniqueIPs.length,
    uniqueLocationCount: uniqueLocations.length,
  };
}

