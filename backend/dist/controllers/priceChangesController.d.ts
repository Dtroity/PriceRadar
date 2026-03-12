import type { Request, Response } from 'express';
export declare function list(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function priceHistory(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
