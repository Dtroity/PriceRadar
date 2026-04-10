/**
 * Keys for SaaS modules (keep in sync with backend/src/config/modules.ts PLATFORM_MODULES).
 */
export const PLATFORM_MODULE_KEYS = [
  'analytics',
  'anomaly_detection',
  'procurement',
  'recommendations',
  'iiko_integration',
  'notifications_email',
  'notifications_vk',
  'notifications_push',
  'ai_features',
  'invoice_ai',
  'price_monitoring',
  'foodcost',
  'supplier_intelligence',
  'telegram_bot',
  'procurement_autopilot',
  'stock',
  'ai_procurement_agent',
  'order_automation',
  'forecast',
] as const;

export type PlatformModuleKey = (typeof PLATFORM_MODULE_KEYS)[number];
