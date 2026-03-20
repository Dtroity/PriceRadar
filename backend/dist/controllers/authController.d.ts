import type { Request, Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
export declare function register(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function login(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function refresh(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function logout(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function me(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function registerOrg(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function loginWithOrg(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
