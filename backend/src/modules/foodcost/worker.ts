import { Queue, Worker } from 'bullmq';
import { config } from '../../config.js';
import * as repo from './repository.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export interface FoodcostRecalcPayload {
  organizationId: string;
  productId: string;
}

export const foodcostRecalcQueue = new Queue<FoodcostRecalcPayload>('foodcost-recalc', { connection });

let worker: Worker<FoodcostRecalcPayload> | null = null;

const FOOD_COST_ALERT_THRESHOLD = 0.35;

export function startFoodcostWorker() {
  if (worker) return worker;
  worker = new Worker<FoodcostRecalcPayload>(
    'foodcost-recalc',
    async (job) => {
      const { organizationId, productId } = job.data;
      const menuItems = await repo.getMenuItemsByProductId(organizationId, productId);
      for (const mi of menuItems) {
        const recipeItems = await repo.getRecipeItems(mi.recipe_id);
        let cost = 0;
        for (const ri of recipeItems) {
          const price = await repo.getCurrentProductPrice(organizationId, ri.product_id);
          if (price != null) cost += Number(ri.quantity) * price;
        }
        const sellingPrice = Number(mi.selling_price);
        const margin = sellingPrice > 0 ? sellingPrice - cost : 0;
        const foodCostPercent = sellingPrice > 0 ? cost / sellingPrice : 0;
        await repo.insertFoodCostHistory(mi.id, cost, margin, foodCostPercent);
        if (foodCostPercent > FOOD_COST_ALERT_THRESHOLD) {
          await repo.createFoodcostAlert(mi.id, foodCostPercent);
        }
      }
    },
    { connection, concurrency: 4 }
  );
  worker.on('failed', (j, err) => console.error('foodcost-recalc failed', j?.id, err));
  return worker;
}

export function stopFoodcostWorker() {
  worker?.close();
  worker = null;
}
