/**
 * Human-readable labels for ingestion classifier output (shared: journal, upload confirm UI).
 */

export type TFn = (key: string) => string;

export function ingestionKindLabel(kind: string | undefined | null, t: TFn): string {
  if (!kind) return '—';
  const k = `ingestion.kind.${kind}`;
  const lbl = t(k);
  return lbl === k ? kind : lbl;
}

/** Maps classifier reason codes to translated sentences. */
export function formatIngestionReasonCode(code: string, t: TFn): string {
  const grid = code.match(/^excel_grid_(\d+)$/);
  if (grid) return t('ingestion.reason.excel_grid').replace('{n}', grid[1]);
  const some = code.match(/^excel_some_rows_(\d+)$/);
  if (some) return t('ingestion.reason.excel_some_rows').replace('{n}', some[1]);
  const key = `ingestion.reason.${code}`;
  const lbl = t(key);
  return lbl === key ? code : lbl;
}

export function shortenId(id: unknown): string {
  if (typeof id !== 'string' || !id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Present nested extra summary fields without JSON — short plain text. */
export function formatExtraSummaryValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((v) => formatExtraSummaryValue(v)).join('; ');
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const parts = Object.entries(o).map(([k, v]) => {
      const label = k.replace(/_/g, ' ');
      const inner = formatExtraSummaryValue(v);
      return `${label}: ${inner}`;
    });
    return parts.join(' · ');
  }
  return String(value);
}
