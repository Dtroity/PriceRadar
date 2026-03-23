import { config } from './config.js';
import createApp from './app.js';
import { pool } from './db/pool.js';
import { startWorkers } from './workers/queue.js';
import { startOrderAutomationWorker } from './modules/order-automation/worker.js';
import { startFoodcostWorker } from './modules/foodcost/worker.js';
import { startSupplierIntelligenceWorker, supplierScoringQueue } from './modules/supplier-intelligence/worker.js';
import { startStockUpdateWorker } from './modules/stock/worker.js';
import { startProcurementAutopilotWorker, procurementAutopilotQueue } from './modules/procurement-autopilot/worker.js';
import { duplicateScanQueue, startDuplicateScanWorker } from './workers/duplicateScanWorker.js';
import { RECOMMENDATIONS_ALL_ORGS, recommendationsQueue, startRecommendationsWorker, } from './workers/recommendationsWorker.js';
import { IIKO_SYNC_ALL, iikoSyncQueue, startIikoSyncWorker } from './workers/iikoSyncWorker.js';
import { startTelegramBot } from './telegram/bot.js';
import { ensureUploadDir } from './middleware/upload.js';
import { runKnexMigrations } from './db/runKnexMigrations.js';
import { logger } from './utils/logger.js';
import { initSentry } from './monitoring/sentry.js';
initSentry();
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
    startRecommendationsWorker();
    startIikoSyncWorker();
    await supplierScoringQueue.add('daily', { organizationId: '' }, { repeat: { pattern: '0 2 * * *' } }).catch(() => { });
    await procurementAutopilotQueue.add('tick', {}, { repeat: { pattern: '0 */6 * * *' } }).catch(() => { });
    await duplicateScanQueue.add('nightly', {}, { repeat: { pattern: '0 3 * * *' } }).catch(() => { });
    await recommendationsQueue
        .add('all-orgs', { organizationId: RECOMMENDATIONS_ALL_ORGS }, { repeat: { pattern: '0 */6 * * *' }, jobId: 'recommendations-all-orgs' })
        .catch(() => { });
    await iikoSyncQueue
        .add('all-orgs', { organizationId: IIKO_SYNC_ALL }, { repeat: { pattern: '0 6 * * *' }, jobId: 'iiko-sync-all-orgs' })
        .catch(() => { });
    startTelegramBot();
    const app = createApp();
    app.listen(config.port, () => {
        logger.info({ port: config.port }, 'Vizor360 API listening');
    });
}
main().catch((err) => {
    logger.error({ err }, 'Fatal startup error');
    process.exit(1);
});
