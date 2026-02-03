import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '@prisma/client';

interface TokenPayload {
  sub: string;
  role: UserRole;
}

const accessOptions: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as unknown as SignOptions['expiresIn'],
};

const refreshOptions: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as SignOptions['expiresIn'],
};

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: TokenPayload = { sub: userId, role };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, accessOptions);
}

export function signRefreshToken(userId: string, role: UserRole): string {
  const payload: TokenPayload = { sub: userId, role };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, refreshOptions);
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET as Secret);
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid refresh token payload');
  }

  const { sub, role } = decoded as Partial<TokenPayload>;
  if (!sub || !role) {
    throw new Error('Invalid refresh token payload');
  }

  return { sub, role };
}