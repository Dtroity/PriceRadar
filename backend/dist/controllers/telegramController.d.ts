import type { Request, Response } from 'express';
export declare function getBotStatus(_req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function listUsers(_req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function allowUser(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function removeUser(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
