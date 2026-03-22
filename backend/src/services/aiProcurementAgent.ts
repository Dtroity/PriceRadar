import { redisClient } from '../db/redis.js';
import * as procurementRecs from '../models/procurementRecommendationsModel.js';
import type { RecommendationRow } from '../models/procurementRecommendationsModel.js';
import { yandexComplete, parseYandexJsonResponse } from './yandexGptClient.js';
import { logger } from '../utils/logger.js';

const CACHE_PREFIX = 'ai-procure-enrich:';
const CACHE_TTL_SEC = 30 * 60;

const AGENT_SYSTEM_PROMPT = `Ты помощник по закупкам. Получаешь список рекомендаций по закупке товаров и контекст: остатки, история цен, аномалии, регулярность закупок.

Твоя задача:
1. Расставить приоритеты (priority: от 1=срочно до 10=не срочно)
2. Написать краткое обоснование для каждой (1-2 предложения на русском)
3. При необходимости скорректировать suggested_qty

Ответь ТОЛЬКО валидным JSON без markdown:
{
  "recommendations": [
    {
      "id": "uuid рекомендации",
      "priority": число от 1 до 10,
      "explanation": "обоснование",
      "suggested_qty": число или null
    }
  ]
}`;

export type EnrichedRecommendation = RecommendationRow & {
  ai_explanation: string | null;
  ai_priority: number;
};

async function cacheGet(key: string): Promise<string | null> {
  try {
    if (redisClient.status === 'wait') await redisClient.connect();
    return await redisClient.get(key);
  } catch (err) {
    logger.warn({ err }, 'Redis cache get skipped');
    return null;
  }
}

async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  try {
    if (redisClient.status === 'wait') await redisClient.connect();
    await redisClient.set(key, value, 'EX', ttlSec);
  } catch (err) {
    logger.warn({ err }, 'Redis cache set skipped');
  }
}

function toBaseRec(r: RecommendationRow): EnrichedRecommendation {
  return {
    ...r,
    ai_explanation: null,
    ai_priority: r.priority,
  };
}

async function buildAgentContext(
  organizationId: string,
  recs: RecommendationRow[]
): Promise<{ recommendations: unknown[] }> {
  return {
    recommendations: recs.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.product_name,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      reason: r.reason,
      suggested_qty: r.suggested_qty,
      suggested_price: r.suggested_price,
      priority: r.priority,
      generated_at: r.generated_at,
    })),
  };
}

function mergeAIResults(
  recs: RecommendationRow[],
  aiList: Array<{
    id: string;
    priority: number;
    explanation: string;
    suggested_qty: number | null;
  }>
): EnrichedRecommendation[] {
  const byId = new Map(aiList.map((a) => [a.id, a]));
  return recs.map((r) => {
    const ai = byId.get(r.id);
    if (!ai) return toBaseRec(r);
    const pr =
      typeof ai.priority === 'number' && Number.isFinite(ai.priority)
        ? Math.min(10, Math.max(1, Math.round(ai.priority)))
        : r.priority;
    return {
      ...r,
      ai_explanation: typeof ai.explanation === 'string' ? ai.explanation : null,
      ai_priority: pr,
      suggested_qty:
        ai.suggested_qty != null && Number.isFinite(ai.suggested_qty)
          ? String(ai.suggested_qty)
          : r.suggested_qty,
    };
  });
}

export async function enrichRecommendationsWithAI(
  organizationId: string
): Promise<EnrichedRecommendation[]> {
  const recs = await procurementRecs.listActive(organizationId);
  if (recs.length === 0) return [];

  if (!process.env.YANDEX_API_KEY || !process.env.YANDEX_FOLDER_ID) {
    return recs.map(toBaseRec);
  }

  const cacheKey = `${CACHE_PREFIX}${organizationId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as EnrichedRecommendation[];
      if (Array.isArray(parsed) && parsed.length === recs.length) {
        const ids = new Set(recs.map((r) => r.id));
        if (parsed.every((p) => p.id && ids.has(p.id))) {
          return parsed;
        }
      }
    } catch {
      /* ignore bad cache */
    }
  }

  const context = await buildAgentContext(organizationId, recs);
  const topRecs = context.recommendations.slice(0, 20);

  const rawText = await yandexComplete(
    [
      { role: 'system', text: AGENT_SYSTEM_PROMPT },
      { role: 'user', text: JSON.stringify({ recommendations: topRecs }) },
    ],
    'pro',
    { temperature: 0.2, maxTokens: 2000 }
  );

  if (!rawText) {
    const out = recs.map(toBaseRec);
    return out;
  }

  type AIResult = {
    recommendations: Array<{
      id: string;
      priority: number;
      explanation: string;
      suggested_qty: number | null;
    }>;
  };
  const parsed = parseYandexJsonResponse<AIResult>(rawText);
  if (!parsed?.recommendations?.length) {
    return recs.map(toBaseRec);
  }

  const merged = mergeAIResults(recs, parsed.recommendations);
  void cacheSet(cacheKey, JSON.stringify(merged), CACHE_TTL_SEC);
  return merged;
}
