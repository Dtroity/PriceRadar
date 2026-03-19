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
import { startTelegramBot } from './telegram/bot.js';
import { ensureUploadDir } from './middleware/upload.js';

async function waitForPostgresReady() {
  const maxAttempts = 12;
  const delayMs = 2000;
  let connected = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      if (!connected) {
        console.log('Connected to PostgreSQL');
        connected = true;
      }

      // Ensure at least the core schema is applied
      await pool.query('SELECT 1 FROM organizations LIMIT 1');
      console.log('Database schema ready');
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isOrgMissing = message.includes('relation "organizations" does not exist');
      if (!isOrgMissing && attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  await ensureUploadDir();
  await waitForPostgresReady();
  startWorkers();
  startOrderAutomationWorker();
  startFoodcostWorker();
  startSupplierIntelligenceWorker();
  startStockUpdateWorker();
  startProcurementAutopilotWorker();

  await supplierScoringQueue.add('daily', { organizationId: '' }, { repeat: { pattern: '0 2 * * *' } }).catch(() => {});
  await procurementAutopilotQueue.add('tick', {}, { repeat: { pattern: '0 */6 * * *' } }).catch(() => {});
  startTelegramBot();

  const app = express();
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json());
  app.use('/api', routes);

  app.listen(config.port, () => {
    console.log(`PriceRadar API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
