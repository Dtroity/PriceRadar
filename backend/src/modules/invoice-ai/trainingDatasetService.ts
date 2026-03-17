import { pool } from '../../db/pool.js';
import { normalizeProductName } from '../../services/normalize.js';

export interface TrainingRow {
  original_text: string;
  corrected_text: string;
  product_id: string | null;
  normalized_original: string;
  normalized_corrected: string;
}

export async function collectTrainingDataset(organizationId?: string): Promise<TrainingRow[]> {
  let query = `
    SELECT af.original_text, af.corrected_text, af.product_id
    FROM ai_feedback af
  `;
  const params: string[] = [];
  if (organizationId) {
    params.push(organizationId);
    query += ` WHERE af.organization_id = $1`;
  }
  query += ` ORDER BY af.created_at DESC`;
  const { rows } = await pool.query(query, params);
  return rows.map((r: { original_text: string; corrected_text: string; product_id: string | null }) => ({
    original_text: r.original_text,
    corrected_text: r.corrected_text,
    product_id: r.product_id,
    normalized_original: normalizeProductName(r.original_text),
    normalized_corrected: normalizeProductName(r.corrected_text),
  }));
}

export function toJSONL(rows: TrainingRow[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n');
}
