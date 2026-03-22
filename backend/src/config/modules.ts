/**
 * Platform module keys for SaaS admin + requireModule routing.
 * Includes legacy keys used by existing requireModule('...') middleware.
 */

export const PLATFORM_MODULES = [
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

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

export const DEFAULT_MODULES: Record<'free' | 'pro' | 'enterprise', readonly PlatformModule[]> = {
  free: ['analytics', 'anomaly_detection'],
  pro: [
    'analytics',
    'anomaly_detection',
    'procurement',
    'recommendations',
    'notifications_email',
    'notifications_push',
    'invoice_ai',
    'price_monitoring',
    'supplier_intelligence',
    'procurement_autopilot',
    'stock',
    'iiko_integration',
  ],
  enterprise: [...PLATFORM_MODULES],
};

/** Always enabled with free tier so core document flow works */
export const FREE_MODULE_EXTRAS: readonly PlatformModule[] = ['invoice_ai'];

export function modulesToEnableForPlan(plan: 'free' | 'pro' | 'enterprise'): string[] {
  const set = new Set<string>(DEFAULT_MODULES[plan]);
  if (plan === 'free') {
    for (const m of FREE_MODULE_EXTRAS) set.add(m);
  }
  return [...set];
}

/**
 * requireModule('price_monitoring') passes if org has row `price_monitoring` OR `analytics`, etc.
 */
export const ROUTE_MODULE_CANDIDATES: Record<string, readonly string[]> = {
  price_monitoring: ['price_monitoring', 'analytics'],
  supplier_intelligence: ['supplier_intelligence', 'analytics'],
  forecast: ['forecast', 'anomaly_detection'],
  invoice_ai: ['invoice_ai'],
  foodcost: ['foodcost'],
  iiko_integration: ['iiko_integration'],
  telegram_bot: ['telegram_bot'],
  procurement_autopilot: ['procurement_autopilot', 'procurement', 'recommendations'],
  stock: ['stock', 'procurement'],
  ai_procurement_agent: ['ai_procurement_agent', 'ai_features'],
  order_automation: ['order_automation'],
};

export function routeModuleCandidates(routeKey: string): string[] {
  const a = ROUTE_MODULE_CANDIDATES[routeKey];
  return a ? [...a] : [routeKey];
}

export const MODULE_LABELS: Record<string, string> = {
  analytics: 'Аналитика цен и поставщиков',
  anomaly_detection: 'Детектор аномалий',
  procurement: 'Закупки',
  recommendations: 'Рекомендации закупок',
  iiko_integration: 'Интеграция iiko',
  notifications_email: 'Email-уведомления',
  notifications_vk: 'VK Notify',
  notifications_push: 'Web Push',
  ai_features: 'AI-функции',
  invoice_ai: 'Счета и OCR',
  price_monitoring: 'Мониторинг цен / загрузки',
  foodcost: 'FoodCost',
  supplier_intelligence: 'Интеллект поставщиков',
  telegram_bot: 'Telegram (legacy)',
  procurement_autopilot: 'Автозакупки / остатки',
  stock: 'Склад',
  ai_procurement_agent: 'AI-агент закупок',
  order_automation: 'Автоматизация заказов',
  forecast: 'Прогноз цен',
};

export function isKnownModuleKey(key: string): boolean {
  return (PLATFORM_MODULES as readonly string[]).includes(key);
}
