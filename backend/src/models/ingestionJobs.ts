import { pool } from '../db/pool.js';

export type IngestionStatus =
  | 'pending_confirm'
  | 'pending_duplicate_confirm'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected_duplicate'
  | 'cancelled';

export interface IngestionJobRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  original_filename: string;
  stored_path: string;
  mime_type: string;
  source_type: string;
  file_sha256: string | null;
  suggested_kind: string;
  confirmed_kind: string | null;
  status: IngestionStatus;
  detection: Record<string, unknown>;
  bullmq_job_id: string | null;
  document_id: string | null;
  price_list_id: string | null;
  error_message: string | null;
  summary: Record<string, unknown>;
  duplicate_of_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `id, organization_id, user_id, original_filename, stored_path, mime_type, source_type,
  file_sha256, suggested_kind, confirmed_kind, status, detection, bullmq_job_id, document_id, price_list_id,
  error_message, summary, duplicate_of_id, created_at, updated_at`;

export async function createIngestionJob(data: {
  organizationId: string;
  userId: string | null;
  originalFilename: string;
  storedPath: string;
  mimeType: string;
  sourceType: string;
  fileSha256: string | null;
  suggestedKind: string;
  status: IngestionStatus;
  detection: Record<string, unknown>;
  duplicateOfId?: string | null;
}): Promise<IngestionJobRow> {
  const { rows } = await pool.query(
    `INSERT INTO ingestion_jobs (
       organization_id, user_id, original_filename, stored_path, mime_type, source_type,
       file_sha256, suggested_kind, status, detection, duplicate_of_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${SELECT}`,
    [
      data.organizationId,
      data.userId,
      data.originalFilename,
      data.storedPath,
      data.mimeType,
      data.sourceType,
      data.fileSha256,
      data.suggestedKind,
      data.status,
      JSON.stringify(data.detection),
      data.duplicateOfId ?? null,
    ]
  );
  return mapRow(rows[0]);
}

function mapRow(r: Record<string, unknown>): IngestionJobRow {
  return {
    id: r.id as string,
    organization_id: r.organization_id as string,
    user_id: (r.user_id as string) ?? null,
    original_filename: r.original_filename as string,
    stored_path: r.stored_path as string,
    mime_type: r.mime_type as string,
    source_type: r.source_type as string,
    file_sha256: (r.file_sha256 as string) ?? null,
    suggested_kind: r.suggested_kind as string,
    confirmed_kind: (r.confirmed_kind as string) ?? null,
    status: r.status as IngestionStatus,
    detection: (typeof r.detection === 'object' && r.detection ? r.detection : {}) as Record<string, unknown>,
    bullmq_job_id: (r.bullmq_job_id as string) ?? null,
    document_id: (r.document_id as string) ?? null,
    price_list_id: (r.price_list_id as string) ?? null,
    error_message: (r.error_message as string) ?? null,
    summary: (typeof r.summary === 'object' && r.summary ? r.summary : {}) as Record<string, unknown>,
    duplicate_of_id: (r.duplicate_of_id as string) ?? null,
    created_at: r.created_at as Date,
    updated_at: r.updated_at as Date,
  };
}

export async function getIngestionById(
  id: string,
  organizationId: string
): Promise<IngestionJobRow | null> {
  const { rows } = await pool.query(`SELECT ${SELECT} FROM ingestion_jobs WHERE id = $1 AND organization_id = $2`, [
    id,
    organizationId,
  ]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listIngestionJobs(organizationId: string, limit = 80): Promise<IngestionJobRow[]> {
  const { rows } = await pool.query(
    `SELECT ${SELECT} FROM ingestion_jobs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [organizationId, limit]
  );
  return rows.map(mapRow);
}

export async function findRecentDuplicateByHash(
  organizationId: string,
  sha256: string,
  withinDays = 90
): Promise<{ id: string; created_at: Date } | null> {
  const since = new Date(Date.now() - withinDays * 86400000);
  const { rows } = await pool.query(
    `SELECT id, created_at FROM ingestion_jobs
     WHERE organization_id = $1 AND file_sha256 = $2
       AND created_at > $3
       AND status NOT IN ('rejected_duplicate', 'cancelled', 'failed')
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, sha256, since]
  );
  return rows[0] ?? null;
}

export async function updateIngestionJob(
  id: string,
  organizationId: string,
  patch: Partial<{
    confirmed_kind: string;
    status: IngestionStatus;
    detection: Record<string, unknown>;
    bullmq_job_id: string | null;
    document_id: string | null;
    price_list_id: string | null;
    error_message: string | null;
    summary: Record<string, unknown>;
  }>
): Promise<void> {
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.confirmed_kind !== undefined) {
    sets.push(`confirmed_kind = $${i++}`);
    vals.push(patch.confirmed_kind);
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${i++}`);
    vals.push(patch.status);
  }
  if (patch.detection !== undefined) {
    sets.push(`detection = $${i++}`);
    vals.push(JSON.stringify(patch.detection));
  }
  if (patch.bullmq_job_id !== undefined) {
    sets.push(`bullmq_job_id = $${i++}`);
    vals.push(patch.bullmq_job_id);
  }
  if (patch.document_id !== undefined) {
    sets.push(`document_id = $${i++}`);
    vals.push(patch.document_id);
  }
  if (patch.price_list_id !== undefined) {
    sets.push(`price_list_id = $${i++}`);
    vals.push(patch.price_list_id);
  }
  if (patch.error_message !== undefined) {
    sets.push(`error_message = $${i++}`);
    vals.push(patch.error_message);
  }
  if (patch.summary !== undefined) {
    sets.push(`summary = $${i++}`);
    vals.push(JSON.stringify(patch.summary));
  }
  vals.push(id, organizationId);
  await pool.query(
    `UPDATE ingestion_jobs SET ${sets.join(', ')} WHERE id = $${i++} AND organization_id = $${i}`,
    vals
  );
}

export async function deleteIngestionRow(id: string, organizationId: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM ingestion_jobs WHERE id = $1 AND organization_id = $2`, [
    id,
    organizationId,
  ]);
  return (rowCount ?? 0) > 0;
}
