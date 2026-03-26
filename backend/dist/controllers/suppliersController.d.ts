import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
export declare function list(req: unknown, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function createSupplier(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function patchSupplier(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function listSupplierFilters(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function addSupplierFilter(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function deleteSupplierFilter(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function inviteSupplier(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
