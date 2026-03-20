import OpenAI from 'openai';
import { config } from '../config.js';
import { fetchWithRetry } from '../services/http.js';

export type AiModelSource = 'openai' | 'ollama';

export interface AiClientOptions {
  model?: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

function getSource(): AiModelSource {
  if (OPENAI_API_KEY) return 'openai';
  return 'ollama';
}

const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY,
    })
  : null;

export async function completeJson<T = unknown>(prompt: string, options?: AiClientOptions): Promise<T> {
  const source = getSource();
  const model = options?.model ?? AI_MODEL;

  if (source === 'openai') {
    if (!openai) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const content = response.choices[0]?.message?.content ?? '';
    return safeParseJson<T>(content);
  }

  // Ollama-compatible fallback
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

