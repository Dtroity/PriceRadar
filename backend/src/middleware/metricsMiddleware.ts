import type { NextFunction, Request, Response } from 'express';
import { httpRequestDurationSeconds, httpRequestsTotal } from '../monitoring/metrics.js';

function routeLabel(req: Request): string {
  if (req.route?.path) {
    const base = req.baseUrl ?? '';
    return `${base}${req.route.path}` || req.path;
  }
  return req.path || 'unknown';
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationSec = Number(durationNs) / 1e9;
    const route = routeLabel(req);
    const method = req.method;
    const status = String(res.statusCode);
    try {
      httpRequestsTotal.inc({ method, route, status_code: status });
      httpRequestDurationSeconds.observe({ method, route }, durationSec);
    } catch {
      /* ignore metric errors */
    }
  });
  next();
}
