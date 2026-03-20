import { extractVisionPageOcr, isGoogleVisionConfigured } from './vision.service.js';
import { pdfBufferToPngBuffers } from './pdfRasterizePoppler.js';
import { runOcrFromBuffer } from '../ai/ocrProcessor.js';
import { logger } from '../utils/logger.js';

export type OcrEngineLabel = 'google_vision' | 'tesseract' | 'mixed';

export interface OcrResult {
  text: string;
  confidence: number;
  engine: OcrEngineLabel;
}

function isPdfMime(mimeType: string, filePath: string): boolean {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('pdf')) return true;
  return filePath.toLowerCase().endsWith('.pdf');
}

async function ocrOnePage(buffer: Buffer): Promise<{
  text: string;
  confidence: number;
  usedVision: boolean;
}> {
  if (isGoogleVisionConfigured()) {
    try {
      const { text, confidence } = await extractVisionPageOcr(buffer);
      if (text.trim()) {
        return { text, confidence, usedVision: true };
      }
    } catch (err) {
      logger.warn(
        { err, msg: '[Vision OCR] documentTextDetection failed, falling back to Tesseract' },
        '[Vision OCR] failed'
      );
    }
  }

  const { text, confidence } = await runOcrFromBuffer(buffer);
  return { text, confidence, usedVision: false };
}

function aggregatePages(
  pages: Array<{ text: string; confidence: number; usedVision: boolean }>
): { text: string; confidence: number; engine: OcrEngineLabel } {
  let nVision = 0;
  let nTess = 0;
  let wSum = 0;
  let cSum = 0;
  const parts: string[] = [];

  for (const p of pages) {
    if (p.text.trim()) parts.push(p.text.trim());
    const w = Math.max(1, p.text.length);
    wSum += w;
    cSum += p.confidence * w;
    if (p.usedVision) nVision += 1;
    else nTess += 1;
  }

  const text = parts.join('\n\n');
  const confidence = wSum > 0 ? cSum / wSum : 0;

  let engine: OcrEngineLabel;
  if (nVision > 0 && nTess === 0) engine = 'google_vision';
  else if (nVision === 0 && nTess > 0) engine = 'tesseract';
  else if (nVision > 0 && nTess > 0) engine = 'mixed';
  else engine = 'tesseract';

  return { text, confidence, engine };
}

/**
 * Image: Vision→Tesseract pass. PDF: poppler pages → OCR each page.
 */
export async function ocrDocumentBuffer(
  buffer: Buffer,
  mimeType: string,
  filePath: string,
  context?: { documentId?: string; organizationId?: string }
): Promise<OcrResult> {
  const ctx = context ?? {};

  if (isPdfMime(mimeType, filePath)) {
    let pageBuffers: Buffer[];
    try {
      pageBuffers = await pdfBufferToPngBuffers(buffer);
    } catch (err) {
      logger.error(
        { err, ...ctx, msg: '[PDF OCR] pdftoppm failed' },
        '[PDF OCR] pdftoppm failed'
      );
      return {
        text: '',
        confidence: 0,
        engine: 'tesseract',
      };
    }

    if (pageBuffers.length === 0) {
      return { text: '', confidence: 0, engine: 'tesseract' };
    }

    const pageResults: Array<{ text: string; confidence: number; usedVision: boolean }> = [];
    for (const pageBuf of pageBuffers) {
      pageResults.push(await ocrOnePage(pageBuf));
    }

    const agg = aggregatePages(pageResults);
    logger.info(
      {
        ...ctx,
        engine: agg.engine,
        confidence: agg.confidence,
        charCount: agg.text.length,
        msg: 'OCR completed (PDF)',
      },
      'OCR completed'
    );
    return agg;
  }

  const page = await ocrOnePage(buffer);
  const agg = aggregatePages([page]);
  logger.info(
    {
      ...ctx,
      engine: agg.engine,
      confidence: agg.confidence,
      charCount: agg.text.length,
      msg: 'OCR completed (image)',
    },
    'OCR completed'
  );
  return agg;
}
