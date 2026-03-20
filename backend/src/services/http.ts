import { config } from '../config.js';

type RetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const retries = options.retries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 500;
  const retryOnStatuses = options.retryOnStatuses ?? [429, 500, 502, 503, 504];

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (!retryOnStatuses.includes(res.status) || attempt === retries) {
        return res;
      }

      if (config.debug) {
        console.log(
          `[debug] fetch retry status=${res.status} attempt=${attempt}/${retries} url=${String(input)}`
        );
      }
      await sleep(retryDelayMs * attempt);
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      if (config.debug) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(
          `[debug] fetch retry network_error="${message}" attempt=${attempt}/${retries} url=${String(input)}`
        );
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry failed');
}

