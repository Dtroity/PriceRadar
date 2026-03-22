import * as analyticsModel from '../models/analyticsModel.js';
import { yandexComplete, parseYandexJsonResponse } from './yandexGptClient.js';

export interface ForecastPoint {
  date: string;
  price: number;
  supplier_name: string;
}

export interface PriceForecastResult {
  predicted_price: number;
  confidence: 'low' | 'medium' | 'high';
  trend: 'up' | 'down' | 'stable';
  change_pct: number;
  explanation: string;
  fallback?: boolean;
  horizon_days: number;
}

function flattenHistory(
  data: Awaited<ReturnType<typeof analyticsModel.getPriceHistory>>
): ForecastPoint[] {
  const pts: ForecastPoint[] = [];
  for (const s of data.series) {
    for (const p of s.points) {
      pts.push({
        date: p.date,
        price: p.price,
        supplier_name: s.supplier.name,
      });
    }
  }
  pts.sort((a, b) => a.date.localeCompare(b.date));
  return pts;
}

/** Simple least-squares line y = a + b*x on last prices (x = day index). */
export function linearRegressionForecast(
  history: ForecastPoint[],
  horizonDays: number
): PriceForecastResult {
  const prices = history.map((h) => h.price);
  const n = prices.length;
  const xMean = (n - 1) / 2;
  const yMean = prices.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (prices[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  const a = yMean - b * xMean;
  const xFuture = n - 1 + horizonDays;
  const predicted = Math.max(0, a + b * xFuture);
  const first = prices[0] ?? predicted;
  const change_pct = first > 0 ? ((predicted - first) / first) * 100 : 0;
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (change_pct > 1) trend = 'up';
  else if (change_pct < -1) trend = 'down';
  return {
    predicted_price: Math.round(predicted * 100) / 100,
    confidence: 'low',
    trend,
    change_pct: Math.round(change_pct * 100) / 100,
    explanation:
      'Линейный тренд по истории цен (fallback без YandexGPT). Для точности добавьте больше точек прайсов.',
    fallback: true,
    horizon_days: horizonDays,
  };
}

function buildForecastPrompt(history: ForecastPoint[], horizonDays: number): string {
  const points = history.map((p) => `${p.date}: ${p.price} руб (${p.supplier_name})`).join('\n');
  return `Ты аналитик закупочных цен. Проанализируй историю цен и сделай прогноз на ${horizonDays} дней вперёд.

История цен:
${points}

Ответь ТОЛЬКО валидным JSON без markdown, без пояснений до и после:
{
  "predicted_price": число,
  "confidence": "low" или "medium" или "high",
  "trend": "up" или "down" или "stable",
  "change_pct": число,
  "explanation": "2-3 предложения на русском языке"
}`;
}

export async function forecastPriceForProduct(params: {
  organizationId: string;
  productId: string;
  horizonDays: number;
}): Promise<PriceForecastResult> {
  const horizonDays =
    Number.isFinite(params.horizonDays) && params.horizonDays > 0
      ? Math.min(Math.floor(params.horizonDays), 365)
      : 14;

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - 365 * 24 * 60 * 60 * 1000);

  const histData = await analyticsModel.getPriceHistory({
    organizationId: params.organizationId,
    productId: params.productId,
    dateFrom,
    dateTo,
    supplierId: null,
  });

  const history = flattenHistory(histData);
  if (history.length < 3) {
    if (history.length === 0) {
      return {
        predicted_price: 0,
        confidence: 'low',
        trend: 'stable',
        change_pct: 0,
        explanation: 'Недостаточно истории цен для прогноза.',
        fallback: true,
        horizon_days: horizonDays,
      };
    }
    return linearRegressionForecast(history, horizonDays);
  }

  const rawText = await yandexComplete(
    [{ role: 'user', text: buildForecastPrompt(history, horizonDays) }],
    'lite',
    { temperature: 0.1, maxTokens: 300 }
  );
  if (!rawText) {
    return linearRegressionForecast(history, horizonDays);
  }

  type Parsed = {
    predicted_price?: number;
    confidence?: string;
    trend?: string;
    change_pct?: number;
    explanation?: string;
  };
  const parsed = parseYandexJsonResponse<Parsed>(rawText);
  if (
    !parsed ||
    typeof parsed.predicted_price !== 'number' ||
    !Number.isFinite(parsed.predicted_price)
  ) {
    return linearRegressionForecast(history, horizonDays);
  }

  const conf =
    parsed.confidence === 'medium' || parsed.confidence === 'high' ? parsed.confidence : 'low';
  const trend =
    parsed.trend === 'up' || parsed.trend === 'down' || parsed.trend === 'stable'
      ? parsed.trend
      : 'stable';

  return {
    predicted_price: parsed.predicted_price,
    confidence: conf,
    trend,
    change_pct:
      typeof parsed.change_pct === 'number' && Number.isFinite(parsed.change_pct)
        ? parsed.change_pct
        : 0,
    explanation:
      typeof parsed.explanation === 'string' && parsed.explanation.trim()
        ? parsed.explanation.trim()
        : 'Прогноз по истории закупочных цен.',
    horizon_days: horizonDays,
  };
}
