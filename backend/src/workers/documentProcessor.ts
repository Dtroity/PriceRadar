import type { Job } from 'bullmq';
import { readFile } from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import * as documentsModel from '../models/documents.js';
import { pool } from '../db/pool.js';

const CONFIDENCE_THRESHOLD = 0.7;

export interface DocumentJobPayload {
  documentId: string;
  organizationId: string;
  filePath: string;
  mimeType: string;
}

function resolveFilePath(filePath: string): string {
  return path.isAbsolute(filePath) ? path.resolve(process.cwd(), filePath) : path.resolve(process.cwd(), filePath);
}

export async function processDocumentJob(job: Job<DocumentJobPayload>): Promise<void> {
  const { documentId, organizationId, filePath, mimeType } = job.data;
  const absPath = resolveFilePath(filePath);

  let buffer: Buffer;
  try {
    buffer = await readFile(absPath);
  } catch (err) {
    await recordError(documentId, err instanceof Error ? err.message : 'File read failed');
    await documentsModel.updateParsed(documentId, organizationId, { status: 'failed' });
    throw err;
  }

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), path.basename(filePath));

  const baseUrl = config.aiServiceUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/parse-invoice`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    await recordError(documentId, `AI service error: ${response.status} ${text}`);
    await documentsModel.updateParsed(documentId, organizationId, { status: 'failed' });
    throw new Error(`parse-invoice failed: ${response.status}`);
  }

  const parsed = (await response.json()) as {
    supplier?: string | null;
    documentNumber?: string | null;
    date?: string | null;
    items?: Array<{
      name?: string | null;
      quantity?: number;
      unit?: string | null;
      price?: number | null;
      sum?: number | null;
      vat?: number | null;
    }>;
    total?: number | null;
    confidence?: number | null;
  };

  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : null;
  const status = confidence !== null && confidence < CONFIDENCE_THRESHOLD ? 'needs_review' : 'parsed';

  const docDate = parsed.date
    ? (() => {
        const d = new Date(parsed.date!);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      })()
    : null;

  await documentsModel.updateParsed(documentId, organizationId, {
    supplier_name: parsed.supplier ?? null,
    document_number: parsed.documentNumber ?? null,
    document_date: docDate,
    total_amount: parsed.total ?? null,
    status,
    confidence,
  });

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  await documentsModel.deleteItems(documentId);
  if (items.length > 0) {
    const needsReview = status === 'needs_review';
    await documentsModel.insertItems(
      documentId,
      items.map((it, i) => ({
        line_index: i,
        name: it.name ?? null,
        quantity: typeof it.quantity === 'number' ? it.quantity : 0,
        unit: it.unit ?? null,
        price: it.price ?? null,
        sum: it.sum ?? null,
        vat: it.vat ?? null,
        needs_review: needsReview,
      }))
    );
  }
}

async function recordError(documentId: string, errorMessage: string): Promise<void> {
  await pool.query(
    `INSERT INTO processing_errors (document_id, error_message, retry_count) VALUES ($1, $2, 0)`,
    [documentId, errorMessage]
  );
}
