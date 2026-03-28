/**
 * Yandex Cloud Foundation Models — text embeddings for product deduplication.
 * @see https://yandex.cloud/ru/docs/foundation-models/
 */
import { pool } from '../db/pool.js';
import { logger } from '../utils/logger.js';

let loggedYandexEmbed403 = false;

const YANDEX_EMBED_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding';

function embedModelUri(): string {
  return `emb://${process.env.YANDEX_FOLDER_ID}/text-search-doc/latest`;
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF\s%.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function vectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

function parseEmbeddingPayload(data: unknown): number[] | null {
  if (!data || typeof data !== 'object') return null;
  const emb = (data as { embedding?: unknown }).embedding;
  if (Array.isArray(emb) && emb.every((x) => typeof x === 'number')) {
    return emb as number[];
  }
  if (emb && typeof emb === 'object' && Array.isArray((emb as { vector?: unknown }).vector)) {
    const v = (emb as { vector: unknown[] }).vector;
    if (v.every((x) => typeof x === 'number')) return v as number[];
  }
  return null;
}

export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.YANDEX_API_KEY || !process.env.YANDEX_FOLDER_ID) {
    return null;
  }
  try {
    const res = await fetch(YANDEX_EMBED_URL, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
        'Content-Type': 'application/json',
        'x-folder-id': process.env.YANDEX_FOLDER_ID,
      },
      body: JSON.stringify({
        modelUri: embedModelUri(),
        text: normalizeProductName(text),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 403 && !loggedYandexEmbed403) {
        loggedYandexEmbed403 = true;
        logger.warn(
          { status: res.status },
          'Yandex embeddings недоступны (403/права каталога): сопоставление товаров работает без векторов; задайте роль сервисного аккаунта на каталог или отключите YANDEX_*'
        );
      }
      throw new Error(`Yandex Embed API: ${res.status} ${errText}`);
    }
    const data = await res.json();
    return parseEmbeddingPayload(data);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('Yandex Embed API: 403')) {
      logger.error({ err }, 'Yandex embedding failed');
    }
    return null;
  }
}

/** Yandex has no batch embedding API — sequential calls with ~9 req/s. */
export async function getEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  for (const text of texts) {
    results.push(await getEmbedding(text));
    await new Promise((r) => setTimeout(r, 110));
  }
  return results;
}

export async function persistProductEmbedding(
  productId: string,
  organizationId: string,
  embedding: number[]
): Promise<void> {
  if (!embedding.length) return;
  await pool.query(
    `UPDATE products SET name_embedding = $1::vector WHERE id = $2::uuid AND organization_id = $3::uuid`,
    [vectorLiteral(embedding), productId, organizationId]
  );
}

/** Fire-and-forget safe: computes embedding from display name and stores when Yandex is configured. */
export async function refreshProductEmbedding(
  productId: string,
  organizationId: string,
  displayName: string
): Promise<void> {
  const emb = await getEmbedding(displayName);
  if (!emb?.length) return;
  await persistProductEmbedding(productId, organizationId, emb);
}
