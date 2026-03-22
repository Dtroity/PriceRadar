/**
 * YandexGPT completion API (Foundation Models v1).
 * @see https://yandex.cloud/ru/docs/foundation-models/
 */
import { logger } from '../utils/logger.js';

const YANDEX_COMPLETION_URL =
  'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

export interface YandexMessage {
  role: 'system' | 'user' | 'assistant';
  text: string;
}

export interface YandexCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export function parseYandexJsonResponse<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export async function yandexComplete(
  messages: YandexMessage[],
  model: 'pro' | 'lite' = 'lite',
  options: YandexCompletionOptions = {}
): Promise<string | null> {
  if (!process.env.YANDEX_API_KEY || !process.env.YANDEX_FOLDER_ID) {
    return null;
  }
  const modelUri =
    model === 'pro'
      ? `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt/latest`
      : `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite/latest`;

  try {
    const res = await fetch(YANDEX_COMPLETION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
        'x-folder-id': process.env.YANDEX_FOLDER_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: {
          stream: options.stream ?? false,
          temperature: options.temperature ?? 0.1,
          maxTokens: options.maxTokens ?? 500,
        },
        messages,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ status: res.status, body }, 'YandexGPT completion failed');
      return null;
    }
    const data = (await res.json()) as {
      result?: { alternatives?: Array<{ message?: { text?: string } }> };
    };
    return data.result?.alternatives?.[0]?.message?.text ?? null;
  } catch (err) {
    logger.error({ err }, 'YandexGPT completion error');
    return null;
  }
}
