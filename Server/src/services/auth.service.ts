import { prisma } from '../db/client';
import { AppError } from '../utils/appError';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token';
import type { User, UserRole } from '@prisma/client';
import { createLoginHistory } from './loginHistory.service';
import { createSession, invalidateSession, getUserActiveSessions } from './sessionActivity.service';
import { createMultipleDeviceLoginAlert, createFailedLoginAlert } from './securityAlert.service';
import { getLocationFromIP, isSuspiciousLocationChange } from '../utils/geolocation';
import { parseDeviceInfo, getDeviceFingerprint } from '../utils/deviceFingerprint';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginMetadata {
  ipAddress?: string;
  userAgent?: string;
  macAddress?: string;
  deviceMetadata?: any;
}

export async function bootstrapSuperAdmin(email: string, password: string): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (existing) {
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
}

export async function login(
  email: string, 
  password: string,
  metadata?: LoginMetadata
): Promise<{ user: User; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Check if user exists and is active
  if (!user || user.status !== 'ACTIVE') {
    // Record failed login attempt only if user exists (to avoid FK constraint violation)
    if (metadata && user) {
      await createLoginHistory({
        userId: user.id,
        email,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        macAddress: metadata.macAddress,
        success: false,
        failureReason: 'Invalid credentials or inactive account',
      });

      // Create alert for multiple failed attempts
      const location = await getLocationFromIP(metadata.ipAddress);
      await createFailedLoginAlert({
        email,
        ipAddress: metadata.ipAddress || 'Unknown',
        location: location?.location || null,
        attemptCount: 1,
        reason: 'Invalid credentials or inactive account',
      });
    }
    
    throw new AppError('Invalid email or password', 401);
  }

  // Verify password
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    // Record failed login attempt
    if (metadata) {
      await createLoginHistory({
        userId: user.id,
        email,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        macAddress: metadata.macAddress,
        success: false,
        failureReason: 'Incorrect password',
      });
    }
    
    throw new AppError('Invalid email or password', 401);
  }

  // === SINGLE SESSION ENFORCEMENT ===
  // Check if user has an active session on another device
  const existingSessions = await getUserActiveSessions(user.id);
  let previousDevice = null;
  let previousIP = null;
  let previousLocation = null;

  if (existingSessions.length > 0) {
    // Get info about the previous session for the alert
    const oldSession = existingSessions[0];
    if (oldSession) {
      previousDevice = oldSession.deviceInfo || 'Unknown Device';
      previousIP = oldSession.ipAddress || 'Unknown IP';
      previousLocation = oldSession.location;
    }

    // Invalidate all existing sessions
    for (const session of existingSessions) {
      await invalidateSession(session.sessionToken, 'new_login');
    }

    // Clear the user's current session token
    await prisma.user.update({
      where: { id: user.id },
      data: { currentSessionToken: null },
    });

    // Create security alert for admin
    if (metadata) {
      const newLocation = await getLocationFromIP(metadata.ipAddress);
      const newDeviceInfo = parseDeviceInfo(metadata.userAgent);
      const newDevice = getDeviceFingerprint(newDeviceInfo);

      await createMultipleDeviceLoginAlert({
        userId: user.id,
        userEmail: user.email,
        previousDevice,
        previousIP,
        previousLocation,
        newDevice,
        newIP: metadata.ipAddress || 'Unknown',
        newLocation: newLocation?.location || null,
      });
    }
  }

  // Generate new tokens
  const tokens = issueTokens(user.id, user.role);

  // Update user with new session info
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIP: metadata?.ipAddress,
      currentSessionToken: tokens.accessToken,
    },
  });

  // Record successful login in history
  if (metadata) {
    await createLoginHistory({
      userId: user.id,
      email: user.email,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      macAddress: metadata.macAddress,
      deviceMetadata: metadata.deviceMetadata,
      success: true,
    });

    // Create new session activity record
    await createSession({
      userId: user.id,
      sessionToken: tokens.accessToken,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      macAddress: metadata.macAddress,
      deviceMetadata: metadata.deviceMetadata,
    });
  }

  return { user, tokens };
}

export function issueTokens(userId: string, role: UserRole): AuthTokens {
  return {
    accessToken: signAccessToken(userId, role),
    refreshToken: signRefreshToken(userId, role),
  };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('User is not active', 403);
    }

    const tokens = issueTokens(user.id, user.role);

    // CRITICAL: Update user's currentSessionToken to the new access token
    // This allows the refreshed token to pass validation
    await prisma.user.update({
      where: { id: user.id },
      data: { currentSessionToken: tokens.accessToken },
    });

    return tokens;
  } catch (error) {
    throw new AppError('Invalid refresh token', 401);
  }
}
