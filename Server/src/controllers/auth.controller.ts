import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { login, refreshTokens } from '../services/auth.service';
import type { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db/client';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  macAddress: z.string().optional(),
  deviceMetadata: z.any().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const loginHandler = asyncHandler(async (req, res) => {
  const { email, password, macAddress, deviceMetadata } = loginSchema.parse(req.body);
  
  // Extract IP address from request
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                     req.ip ||
                     req.socket.remoteAddress;
  
  // Extract User-Agent
  const userAgent = req.headers['user-agent'];
  
  // Call login with metadata
  const { user, tokens } = await login(email, password, {
    ipAddress,
    userAgent,
    macAddress,
    deviceMetadata,
  });

  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokens = await refreshTokens(refreshToken);
  return res.status(200).json(tokens);
});

export const meHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.status(200).json(user);
});

export const sessionStatusHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // If we reach here, the authenticate middleware has already validated the session
  // So the session is valid
  return res.status(200).json({
    valid: true,
    userId: req.user?.id,
  });
});
