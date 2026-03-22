import { fetchWithRetry } from '../services/http.js';
import { yandexComplete, parseYandexJsonResponse } from '../services/yandexGptClient.js';

export type AiModelSource = 'yandex' | 'ollama';

export interface AiClientOptions {
  model?: string;
}

const AI_MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

function getSource(): AiModelSource {
  if (process.env.YANDEX_API_KEY && process.env.YANDEX_FOLDER_ID) return 'yandex';
  return 'ollama';
}

export async function completeJson<T = unknown>(prompt: string, options?: AiClientOptions): Promise<T> {
  const source = getSource();
  const model = options?.model ?? AI_MODEL;

  if (source === 'yandex') {
    const raw = await yandexComplete([{ role: 'user', text: prompt }], 'lite', {
      temperature: 0,
      maxTokens: 2000,
    });
    if (!raw) {
      throw new Error('YandexGPT is not configured or request failed');
    }
    const parsed = parseYandexJsonResponse<T>(raw);
    if (parsed == null) {
      throw new Error('YandexGPT response does not contain valid JSON');
    }
    return parsed;
  }

  const res = await fetchWithRetry(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status}`);
  }
  const data = await res.json();
  const content = data?.message?.content ?? data?.choices?.[0]?.message?.content ?? '';
  return safeParseJson<T>(content);
}

function safeParseJson<T>(text: string): T {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error('AI response does not contain JSON object');
  }
  const jsonText = trimmed.slice(jsonStart, jsonEnd + 1);
  return JSON.parse(jsonText) as T;
}
