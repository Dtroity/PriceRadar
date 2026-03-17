/**
 * Proviator module registry — mount modular routers (loosely coupled).
 */
import type { Router } from 'express';
import priceMonitoringRoutes from './price-monitoring/routes.js';
import invoiceAiRoutes from './invoice-ai/routes.js';
import forecastRoutes from './forecast/routes.js';
import foodcostRoutes from './foodcost/routes.js';
import supplierIntelligenceRoutes from './supplier-intelligence/routes.js';
import orderAutomationRoutes from './order-automation/routes.js';
import aiProcurementAgentRoutes from './ai-procurement-agent/routes.js';
import integrationsRoutes from './integrations/routes.js';
import stockRoutes from './stock/routes.js';
import procurementAutopilotRoutes from './procurement-autopilot/routes.js';

export const MODULE_KEYS = [
  'price_monitoring',
  'invoice_ai',
  'forecast',
  'foodcost',
  'supplier_intelligence',
  'order_automation',
  'ai_procurement_agent',
  'telegram_bot',
  'iiko_integration',
] as const;

export function mountModuleRoutes(api: Router) {
  api.use('/modules/price-monitoring', priceMonitoringRoutes);
  api.use('/modules/invoice-ai', invoiceAiRoutes);
  api.use('/modules/forecast', forecastRoutes);
  api.use('/modules/foodcost', foodcostRoutes);
  api.use('/modules/supplier-intelligence', supplierIntelligenceRoutes);
  api.use('/order-automation', orderAutomationRoutes);
  api.use('/procurement', aiProcurementAgentRoutes);
  api.use('/modules/integrations', integrationsRoutes);
  api.use('/stock', stockRoutes);
  api.use('/procurement-autopilot', procurementAutopilotRoutes);
}
