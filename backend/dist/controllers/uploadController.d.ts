import type { Request, Response } from 'express';
export declare function upload(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
