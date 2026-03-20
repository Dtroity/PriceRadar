import type { NextFunction, Response } from 'express';
import * as Sentry from '@sentry/node';
import type { AuthRequest } from '../auth/middleware.js';

export function sentryUserMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!process.env.SENTRY_DSN) return next();
  if (req.user) {
    Sentry.setUser({ id: req.user.userId, username: req.user.email });
    if (req.user.organizationId) {
      Sentry.setContext('organization', { id: req.user.organizationId });
    }
  }
  next();
}
