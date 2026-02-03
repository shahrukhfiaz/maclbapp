import type { Request, Response, NextFunction } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { prisma } from '../db/client';
import type { UserRole } from '@prisma/client';
import { updateSessionActivity } from '../services/sessionActivity.service';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}

interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export function authenticate(requiredRoles?: UserRole[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new AppError('Authentication token missing', 401));
    }

    const parts = authHeader.split(' ');
    const token = parts[1];
    if (!token) {
      return next(new AppError('Authentication token missing', 401));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET as Secret);
      if (!decoded || typeof decoded !== 'object') {
        return next(new AppError('Invalid or expired token', 401));
      }

      const { sub, role } = decoded as Partial<AccessTokenPayload>;
      if (!sub || !role) {
        return next(new AppError('Invalid or expired token', 401));
      }

      const user = await prisma.user.findUnique({ where: { id: sub } });

      if (!user || user.status !== 'ACTIVE') {
        return next(new AppError('User is not active', 403));
      }

      // === SINGLE SESSION ENFORCEMENT ===
      // Check if this token matches the user's current active session
      // If user.currentSessionToken is null, it means they haven't logged in yet with the new system
      // OR the feature is being rolled out - so we allow it for backward compatibility
      if (user.currentSessionToken && user.currentSessionToken !== token) {
        return next(new AppError('Session invalidated. You have been logged in from another device.', 401));
      }

      // Update session activity timestamp (non-blocking)
      if (user.currentSessionToken) {
        updateSessionActivity(token).catch(err => {
          console.error('Failed to update session activity:', err);
        });
      }

      if (requiredRoles && !requiredRoles.includes(user.role)) {
        return next(new AppError('Insufficient permissions', 403));
      }

      req.user = { id: user.id, role: user.role };
      return next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }

      return next(new AppError('Invalid or expired token', 401));
    }
  };
}