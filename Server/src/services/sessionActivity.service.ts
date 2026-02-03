/**
 * Session Activity Service
 * 
 * Manages active session tracking and lifecycle
 */

import { prisma } from '../db/client';
import { getLocationFromIP, LocationData } from '../utils/geolocation';
import { parseDeviceInfo, getDeviceFingerprint } from '../utils/deviceFingerprint';

export interface CreateSessionParams {
  userId: string;
  sessionToken: string;
  ipAddress?: string;
  userAgent?: string;
  macAddress?: string;
  deviceMetadata?: any;
}

/**
 * Create a new active session record
 */
export async function createSession(params: CreateSessionParams) {
  // Get location from IP
  let locationData: LocationData | null = null;
  if (params.ipAddress) {
    locationData = await getLocationFromIP(params.ipAddress);
  }

  // Parse device info from User-Agent
  const deviceInfo = parseDeviceInfo(params.userAgent);
  const deviceFingerprint = getDeviceFingerprint(deviceInfo);

  // Create the session activity record
  const sessionActivity = await prisma.sessionActivity.create({
    data: {
      userId: params.userId,
      sessionToken: params.sessionToken,
      ipAddress: params.ipAddress,
      location: locationData?.location,
      city: locationData?.city,
      country: locationData?.country,
      latitude: locationData?.latitude,
      longitude: locationData?.longitude,
      macAddress: params.macAddress,
      deviceInfo: deviceFingerprint,
      userAgent: params.userAgent,
      isActive: true,
    },
  });

  return sessionActivity;
}

/**
 * Invalidate a session (mark as inactive)
 */
export async function invalidateSession(
  sessionToken: string,
  logoutReason: string = 'manual'
) {
  const updated = await prisma.sessionActivity.updateMany({
    where: {
      sessionToken,
      isActive: true,
    },
    data: {
      isActive: false,
      logoutAt: new Date(),
      logoutReason,
    },
  });

  return updated.count > 0;
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(
  userId: string,
  logoutReason: string = 'manual'
) {
  const updated = await prisma.sessionActivity.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
      logoutAt: new Date(),
      logoutReason,
    },
  });

  return updated.count;
}

/**
 * Update last activity timestamp for a session
 */
export async function updateSessionActivity(sessionToken: string) {
  try {
    await prisma.sessionActivity.updateMany({
      where: {
        sessionToken,
        isActive: true,
      },
      data: {
        lastActivityAt: new Date(),
      },
    });
  } catch (error) {
    // Silently fail - don't break requests if activity update fails
    console.error('Failed to update session activity:', error);
  }
}

/**
 * Get all active sessions
 */
export async function getActiveSessions(limit: number = 100) {
  const sessions = await prisma.sessionActivity.findMany({
    where: { isActive: true },
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

  return sessions;
}

/**
 * Get active sessions for a specific user
 */
export async function getUserActiveSessions(userId: string) {
  const sessions = await prisma.sessionActivity.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: { loginAt: 'desc' },
  });

  return sessions;
}

/**
 * Get session history for a user (both active and inactive)
 */
export async function getUserSessionHistory(userId: string, limit: number = 50) {
  const sessions = await prisma.sessionActivity.findMany({
    where: { userId },
    orderBy: { loginAt: 'desc' },
    take: limit,
  });

  return sessions;
}

/**
 * Force logout a session (admin action)
 */
export async function forceLogout(sessionId: string, adminId: string) {
  const session = await prisma.sessionActivity.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Invalidate the session
  await invalidateSession(session.sessionToken, 'forced_by_admin');

  // Clear the user's current session token if it matches
  if (session.isActive) {
    await prisma.user.updateMany({
      where: {
        id: session.userId,
        currentSessionToken: session.sessionToken,
      },
      data: {
        currentSessionToken: null,
      },
    });
  }

  return {
    success: true,
    userId: session.userId,
    userEmail: session.user.email,
  };
}

/**
 * Check if a session token is valid and active
 */
export async function isSessionValid(sessionToken: string): Promise<boolean> {
  const session = await prisma.sessionActivity.findFirst({
    where: {
      sessionToken,
      isActive: true,
    },
  });

  return !!session;
}

/**
 * Get session statistics
 */
export async function getSessionStats() {
  const totalActiveSessions = await prisma.sessionActivity.count({
    where: { isActive: true },
  });

  const totalUsers = await prisma.user.count();

  const activeUsers = await prisma.sessionActivity.findMany({
    where: { isActive: true },
    select: { userId: true },
    distinct: ['userId'],
  });

  const sessionsToday = await prisma.sessionActivity.count({
    where: {
      loginAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  return {
    totalActiveSessions,
    totalUsers,
    activeUsersCount: activeUsers.length,
    sessionsToday,
    activeUsersPercentage: totalUsers > 0 ? ((activeUsers.length / totalUsers) * 100).toFixed(2) : '0',
  };
}

/**
 * Clean up old inactive sessions (run periodically)
 */
export async function cleanupOldSessions(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.sessionActivity.deleteMany({
    where: {
      isActive: false,
      logoutAt: {
        lt: cutoffDate,
      },
    },
  });

  return deleted.count;
}

