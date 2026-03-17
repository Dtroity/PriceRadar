import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from '../types/index.js';
import { config } from '../config.js';

export function signAccessToken(
  userId: string,
  email: string,
  role: UserRole,
  organizationId?: string
): string {
  const payload: Record<string, unknown> = { userId, email, role, type: 'access' };
  if (organizationId) payload.organizationId = organizationId;
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

export function signRefreshToken(
  userId: string,
  email: string,
  role: UserRole,
  organizationId?: string
): string {
  const payload: Record<string, unknown> = { userId, email, role, type: 'refresh' };
  if (organizationId) payload.organizationId = organizationId;
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload & {
    organizationId?: string;
  };
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    type: 'access',
    organizationId: decoded.organizationId,
  } as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  return decoded;
}
