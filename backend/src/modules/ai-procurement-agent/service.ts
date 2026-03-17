import { config } from '../../config.js';
import type { ProcurementRecommendationInput, ProcurementRecommendationsOutput } from './types.js';

export async function fetchRecommendations(
  input: ProcurementRecommendationInput
): Promise<ProcurementRecommendationsOutput> {
  const base = config.aiServiceUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/procurement/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`AI procurement failed: ${res.status}`);
  return res.json() as Promise<ProcurementRecommendationsOutput>;
}
