import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import routes from './routes/index.js';
import { startWorkers } from './workers/queue.js';
import { startOrderAutomationWorker } from './modules/order-automation/worker.js';
import { startFoodcostWorker } from './modules/foodcost/worker.js';
import { startSupplierIntelligenceWorker, supplierScoringQueue } from './modules/supplier-intelligence/worker.js';
import { startStockUpdateWorker } from './modules/stock/worker.js';
import { startProcurementAutopilotWorker, procurementAutopilotQueue } from './modules/procurement-autopilot/worker.js';
import { startTelegramBot } from './telegram/bot.js';
import { ensureUploadDir } from './middleware/upload.js';

async function main() {
  await ensureUploadDir();
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
