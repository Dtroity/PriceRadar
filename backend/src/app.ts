import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import routes from './routes/index.js';
import { requestLogger, errorHandler } from './middleware/diagnostics.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { getRegisterContentType, renderMetrics } from './monitoring/metrics.js';
import { logger } from './utils/logger.js';

/**
 * Express app without listen() — used by integration tests (Supertest) and production entry.
 */
export function createApp(): express.Application {
  const app = express();

  app.get('/metrics', async (_req, res) => {
    try {
      res.setHeader('Content-Type', getRegisterContentType());
      res.send(await renderMetrics());
    } catch (err) {
      logger.error({ err }, 'metrics render failed');
      res.status(500).send('# metrics error');
    }
  });

  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use((req, res, next) => {
    if (req.path === '/metrics') return next();
    return metricsMiddleware(req, res, next);
  });
  app.use(express.json());
  app.use(requestLogger);
  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}

export default createApp;
