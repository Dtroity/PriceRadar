import type { JwtPayload, UserRole } from '../types/index.js';
export declare function signAccessToken(userId: string, email: string, role: UserRole): string;
export declare function signRefreshToken(userId: string, email: string, role: UserRole): string;
export declare function verifyAccessToken(token: string): JwtPayload;
export declare function verifyRefreshToken(token: string): JwtPayload;
