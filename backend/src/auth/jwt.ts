import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from '../types/index.js';
import { config } from '../config.js';

export function signAccessToken(userId: string, email: string, role: UserRole): string {
  return jwt.sign(
    { userId, email, role, type: 'access' },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

export function signRefreshToken(userId: string, email: string, role: UserRole): string {
  return jwt.sign(
    { userId, email, role, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return decoded;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  return decoded;
}
