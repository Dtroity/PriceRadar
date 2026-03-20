import type { Job } from 'bullmq';
import { readFile } from 'fs/promises';
import path from 'path';
import * as documentsModel from '../models/documents.js';
import { pool } from '../db/pool.js';
import { ocrDocumentBuffer } from '../services/documentOcrPipeline.js';
import { parseInvoiceFromText } from '../services/invoiceTextParser.js';
import { OCR_THRESHOLD_AUTO, OCR_THRESHOLD_REVIEW } from '../config/constants.js';
import type { DocumentStatus } from '../types/index.js';
import { logger } from '../utils/logger.js';
import * as Sentry from '@sentry/node';
import { documentsOcrConfidence, documentsProcessedTotal } from '../monitoring/metrics.js';

const PARSE_CONFIDENCE_THRESHOLD = 0.7;

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
    documentsProcessedTotal.inc({ status: 'failed' });
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        extra: { documentId, organizationId, phase: 'read_file' },
      });
    }
    throw err;
  }

  let ocr: Awaited<ReturnType<typeof ocrDocumentBuffer>>;
  try {
    ocr = await ocrDocumentBuffer(buffer, mimeType, filePath, { documentId, organizationId });
  } catch (err) {
    documentsProcessedTotal.inc({ status: 'failed' });
    await documentsModel.updateParsed(documentId, organizationId, { status: 'failed' }).catch(() => {});
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        extra: { documentId, organizationId, jobId: job.id, phase: 'ocr' },
      });
    }
    throw err;
  }

  logger.info(
    {
      documentId,
      organizationId,
      ocrConfidence: ocr.confidence,
      engine: ocr.engine,
      parseSource: null,
      msg: `[OCR] confidence=${ocr.confidence.toFixed(2)}, engine=${ocr.engine}`,
    },
    `[OCR] confidence=${ocr.confidence.toFixed(2)}, engine=${ocr.engine}`
  );

  documentsOcrConfidence.observe(ocr.confidence);

  if (ocr.confidence < OCR_THRESHOLD_REVIEW) {
    await documentsModel.markOcrFailed(documentId, organizationId, ocr.confidence, ocr.engine);
    await recordError(documentId, `OCR confidence ${ocr.confidence} below ${OCR_THRESHOLD_REVIEW}`);
    logger.warn(
      {
        documentId,
        organizationId,
        ocrConfidence: ocr.confidence,
        engine: ocr.engine,
        status: 'ocr_failed',
        msg: 'OCR below threshold; skipping invoice parser',
      },
      'OCR failed threshold'
    );
    documentsProcessedTotal.inc({ status: 'ocr_failed' });
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage('Document OCR failed', {
        level: 'warning',
        extra: { documentId, organizationId, ocrConfidence: ocr.confidence, engine: ocr.engine },
      });
    }
    return;
  }

  let parsed: Awaited<ReturnType<typeof parseInvoiceFromText>>;
  try {
    parsed = await parseInvoiceFromText(ocr.text);
  } catch (err) {
    documentsProcessedTotal.inc({ status: 'failed' });
    await documentsModel.updateParsed(documentId, organizationId, { status: 'failed' }).catch(() => {});
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        extra: { documentId, organizationId, jobId: job.id, phase: 'parse' },
      });
    }
    throw err;
  }

  const parseConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : null;
  let status: DocumentStatus = 'parsed';
  if (ocr.confidence < OCR_THRESHOLD_AUTO) {
    status = 'needs_review';
  } else if (parseConfidence !== null && parseConfidence < PARSE_CONFIDENCE_THRESHOLD) {
    status = 'needs_review';
  }

  logger.info(
    {
      documentId,
      organizationId,
      ocrConfidence: ocr.confidence,
      engine: ocr.engine,
      status,
      parseSource: parsed.source ?? null,
      msg: `[OCR] confidence=${ocr.confidence.toFixed(2)}, engine=${ocr.engine}, status=${status}`,
    },
    `[OCR] confidence=${ocr.confidence.toFixed(2)}, engine=${ocr.engine}, status=${status}`
  );

  const docDate = parsed.date
    ? (() => {
        const d = new Date(parsed.date!);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      })()
    : null;

  await documentsModel.setInvoiceParseResult(documentId, organizationId, {
    supplier_name: parsed.supplier ?? null,
    document_number: parsed.documentNumber ?? null,
    document_date: docDate,
    total_amount: parsed.total ?? null,
    status,
    confidence: parseConfidence,
    ocr_confidence: ocr.confidence,
    ocr_engine: ocr.engine,
    parse_source: parsed.source ?? null,
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

  documentsProcessedTotal.inc({ status });
}

async function recordError(documentId: string, errorMessage: string): Promise<void> {
  await pool.query(
    `INSERT INTO processing_errors (document_id, error_message, retry_count) VALUES ($1, $2, 0)`,
    [documentId, errorMessage]
  );
}
