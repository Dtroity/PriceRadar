import type { User, UserRole } from '../types/index.js';
export declare function findUserByEmail(email: string): Promise<User & {
    password_hash: string;
} | null>;
export declare function findUserById(id: string): Promise<User | null>;
export declare function createUser(email: string, password: string, role?: UserRole): Promise<User>;
export declare function saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
export declare function findRefreshToken(userId: string, tokenHash: string): Promise<boolean>;
export declare function deleteRefreshToken(userId: string, tokenHash: string): Promise<void>;
export declare function deleteExpiredRefreshTokens(): Promise<void>;
