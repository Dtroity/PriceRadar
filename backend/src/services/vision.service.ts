import { existsSync } from 'fs';
import { ImageAnnotatorClient } from '@google-cloud/vision';

let client: ImageAnnotatorClient | null = null;

function getClient(): ImageAnnotatorClient {
  if (!client) {
    client = new ImageAnnotatorClient();
  }
  return client;
}

/** True when GOOGLE_APPLICATION_CREDENTIALS points to an existing file. */
export function isGoogleVisionConfigured(): boolean {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return Boolean(p && existsSync(p));
}

function averageSymbolConfidence(full: unknown): number {
  const doc = full as {
    pages?: Array<{
      blocks?: Array<{
        paragraphs?: Array<{
          words?: Array<{ symbols?: Array<{ confidence?: number }> }>;
        }>;
      }>;
    }>;
  } | null | undefined;
  if (!doc?.pages?.length) return 0;
  let sum = 0;
  let count = 0;
  for (const page of doc.pages) {
    const blocks = page.blocks ?? [];
    for (const block of blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const word of para.words ?? []) {
          for (const sym of word.symbols ?? []) {
            if (typeof sym.confidence === 'number') {
              sum += sym.confidence;
              count += 1;
            }
          }
        }
      }
    }
  }
  if (count === 0) return 0.72;
  return Math.min(1, Math.max(0, sum / count));
}

/**
 * Full document text + mean symbol confidence from Google Vision (documentTextDetection).
 */
export async function extractVisionPageOcr(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const visionClient = getClient();
  const [result] = await visionClient.documentTextDetection({ image: { content: buffer } });
  const fullAnno = result.fullTextAnnotation;
  let text = (fullAnno?.text ?? '').trim();

  let confidence = averageSymbolConfidence(fullAnno);

  if (!text) {
    const [fallback] = await visionClient.textDetection({ image: { content: buffer } });
    const annotations = fallback.textAnnotations;
    const full = annotations?.[0]?.description;
    text = typeof full === 'string' ? full.trim() : '';
    confidence = text ? Math.max(confidence, 0.62) : 0;
  }

  return { text, confidence };
}

/**
 * Back-compat: text only (uses Vision document + text detection).
 */
export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const r = await extractVisionPageOcr(buffer);
  return r.text;
}
