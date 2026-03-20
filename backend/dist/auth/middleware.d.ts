import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types/index.js';
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: UserRole;
        organizationId?: string;
    };
}
export declare function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(...rolesOrArray: (UserRole | UserRole[])[]): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
