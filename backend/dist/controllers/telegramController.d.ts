import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
export declare function getBotStatus(_req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function listUsers(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function allowUser(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function removeUser(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
