import { api } from '../api/client';

export type PriceUploadPollResult = 'completed' | 'failed' | 'timeout';

/**
 * Polls BullMQ job until completed/failed or max wait.
 * @param onProgress — human-readable status for UI (e.g. indeterminate progress label)
 */
export async function pollPriceUploadJob(
  jobId: string,
  onProgress: (label: string) => void,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<PriceUploadPollResult> {
  const intervalMs = options?.intervalMs ?? 1400;
  const maxAttempts = options?.maxAttempts ?? 90;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const st = await api.uploadJobStatus(jobId);
      if (st.state === 'completed') {
        onProgress('');
        return 'completed';
      }
      if (st.state === 'failed') {
        onProgress('');
        return 'failed';
      }
      const phase =
        st.state === 'active'
          ? 'active'
          : st.state === 'waiting' || st.state === 'delayed'
            ? 'queued'
            : st.state;
      onProgress(phase);
    } catch {
      onProgress('error');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return 'timeout';
}
