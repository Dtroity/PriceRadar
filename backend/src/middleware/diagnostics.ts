import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { config } from '../config.js';
import type { AuthRequest } from '../auth/middleware.js';
import { logger } from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  if (config.debug) {
    logger.debug({ method: req.method, url: req.originalUrl, query: req.query }, 'request');
  }

  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId ?? 'anonymous';
    const role = authReq.user?.role ?? 'none';
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        userId,
        role,
        statusCode: res.statusCode,
        responseTimeMs: elapsedMs,
      },
      'http_request'
    );
  });

  next();
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const error = err instanceof Error ? err : new Error(String(err));
  const authReq = req as AuthRequest;
  const userId = authReq.user?.userId ?? 'anonymous';
  const role = authReq.user?.role ?? 'none';
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: {
        path: req.path,
        method: req.method,
        body: req.body,
      },
    });
  }
  logger.error(
    {
      err: error,
      method: req.method,
      url: req.originalUrl,
      userId,
      role,
      stack: error.stack,
    },
    error.message
  );

  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
}

