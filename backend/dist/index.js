import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import routes from './routes/index.js';
import { pool } from './db/pool.js';
import { startWorkers } from './workers/queue.js';
import { startOrderAutomationWorker } from './modules/order-automation/worker.js';
import { startFoodcostWorker } from './modules/foodcost/worker.js';
import { startSupplierIntelligenceWorker, supplierScoringQueue } from './modules/supplier-intelligence/worker.js';
import { startStockUpdateWorker } from './modules/stock/worker.js';
import { startProcurementAutopilotWorker, procurementAutopilotQueue } from './modules/procurement-autopilot/worker.js';
import { duplicateScanQueue, startDuplicateScanWorker } from './workers/duplicateScanWorker.js';
import { startTelegramBot } from './telegram/bot.js';
import { ensureUploadDir } from './middleware/upload.js';
import { requestLogger, errorHandler } from './middleware/diagnostics.js';
import { runKnexMigrations } from './db/runKnexMigrations.js';
import { logger } from './utils/logger.js';
async function waitForPostgresReady() {
    const maxAttempts = 12;
    const delayMs = 2000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await pool.query('SELECT 1');
            logger.info('Connected to PostgreSQL');
            return;
        }
        catch (err) {
            if (attempt >= maxAttempts)
                throw err;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}
async function main() {
    await ensureUploadDir();
    await waitForPostgresReady();
    const applied = await runKnexMigrations();
    logger.info(`DB migrations: ${applied} applied`);
    startWorkers();
    startDuplicateScanWorker();
    startOrderAutomationWorker();
    startFoodcostWorker();
    startSupplierIntelligenceWorker();
    startStockUpdateWorker();
    startProcurementAutopilotWorker();
    await supplierScoringQueue.add('daily', { organizationId: '' }, { repeat: { pattern: '0 2 * * *' } }).catch(() => { });
    await procurementAutopilotQueue.add('tick', {}, { repeat: { pattern: '0 */6 * * *' } }).catch(() => { });
    await duplicateScanQueue.add('nightly', {}, { repeat: { pattern: '0 3 * * *' } }).catch(() => { });
    startTelegramBot();
    const app = express();
    app.use(cors({ origin: config.frontendUrl, credentials: true }));
    app.use(express.json());
    app.use(requestLogger);
    app.use('/api', routes);
    app.use(errorHandler);
    app.listen(config.port, () => {
        logger.info({ port: config.port }, 'PriceRadar API listening');
    });
}
main().catch((err) => {
    logger.error({ err }, 'Fatal startup error');
    process.exit(1);
});
