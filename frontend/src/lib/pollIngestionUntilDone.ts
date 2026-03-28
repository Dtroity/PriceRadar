import { api, type IngestionRecord } from '../api/client';

export type IngestionPollTerminal = 'completed' | 'failed' | 'rejected_duplicate' | 'cancelled' | 'timeout';

export async function pollIngestionUntilDone(
  id: string,
  onTick: (row: IngestionRecord) => void,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<{ outcome: IngestionPollTerminal; last: IngestionRecord }> {
  const intervalMs = options?.intervalMs ?? 1400;
  const maxAttempts = options?.maxAttempts ?? 100;

  let last: IngestionRecord | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const row = await api.ingestion.get(id);
    last = row;
    onTick(row);
    if (row.status === 'completed' || row.status === 'failed' || row.status === 'rejected_duplicate' || row.status === 'cancelled') {
      return { outcome: row.status as IngestionPollTerminal, last: row };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { outcome: 'timeout', last: last! };
}
