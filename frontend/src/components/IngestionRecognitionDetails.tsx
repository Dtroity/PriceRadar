import {
  type TFn,
  formatExtraSummaryValue,
  formatIngestionReasonCode,
  ingestionKindLabel,
  shortenId,
} from '../lib/ingestionLabels';

function pct(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
}

function boolLabel(v: unknown, t: TFn): string {
  return v === true ? t('ingestion.bool.yes') : v === false ? t('ingestion.bool.no') : '—';
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

type Props = {
  detection: Record<string, unknown>;
  summary: Record<string, unknown>;
  t: TFn;
};

/**
 * Human-readable detection/summary for the upload journal (no raw JSON for end users).
 */
export default function IngestionRecognitionDetails({ detection: detIn, summary: sumIn, t }: Props) {
  const detection = asRecord(detIn);
  const summary = asRecord(sumIn);
  const reasons = Array.isArray(detection.reasons)
    ? (detection.reasons as string[]).filter((r) => typeof r === 'string')
    : [];

  const knownSummaryKeys = new Set([
    'rows',
    'changes',
    'supplierId',
    'supplierName',
    'hadPreviousPriceList',
    'line_items',
  ]);

  const extraSummary: [string, unknown][] = Object.entries(summary).filter(
    ([k]) => !knownSummaryKeys.has(k)
  );

  return (
    <div className="space-y-4 text-left font-sans text-xs leading-relaxed text-slate-700">
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h4 className="mb-2 font-semibold text-slate-900">{t('ingestion.detailsSectionDetection')}</h4>
        <dl className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(160px,auto)_1fr]">
          {'suggested' in detection && detection.suggested != null && (
            <>
              <dt className="text-slate-500">{t('ingestion.detection.suggested')}</dt>
              <dd className="font-medium text-slate-900">
                {ingestionKindLabel(String(detection.suggested), t)}
              </dd>
            </>
          )}
          {'alternate' in detection && detection.alternate != null && (
            <>
              <dt className="text-slate-500">{t('ingestion.detection.alternate')}</dt>
              <dd>{ingestionKindLabel(String(detection.alternate), t)}</dd>
            </>
          )}
          {'priceScore' in detection && (
            <>
              <dt className="text-slate-500">{t('ingestion.detection.priceScore')}</dt>
              <dd>{pct(detection.priceScore)}</dd>
            </>
          )}
          {'invoiceScore' in detection && (
            <>
              <dt className="text-slate-500">{t('ingestion.detection.invoiceScore')}</dt>
              <dd>{pct(detection.invoiceScore)}</dd>
            </>
          )}
          {'needsConfirmation' in detection && (
            <>
              <dt className="text-slate-500">{t('ingestion.detection.needsConfirmation')}</dt>
              <dd>{boolLabel(detection.needsConfirmation, t)}</dd>
            </>
          )}
          {typeof detection.excelPriceLikeRows === 'number' && (
            <>
              <dt className="text-slate-500">{t('ingestion.detection.excelPriceLikeRows')}</dt>
              <dd>{detection.excelPriceLikeRows}</dd>
            </>
          )}
        </dl>

        {reasons.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-1.5 font-medium text-slate-700">{t('ingestion.detection.reasons')}</div>
            <ul className="list-disc space-y-1 pl-4 marker:text-slate-400">
              {reasons.map((r) => (
                <li key={r}>{formatIngestionReasonCode(r, t)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h4 className="mb-2 font-semibold text-slate-900">{t('ingestion.detailsSectionSummary')}</h4>
        <dl className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(160px,auto)_1fr]">
          {typeof summary.rows === 'number' && (
            <>
              <dt className="text-slate-500">{t('ingestion.rows')}</dt>
              <dd>{summary.rows}</dd>
            </>
          )}
          {typeof summary.changes === 'number' && (
            <>
              <dt className="text-slate-500">{t('ingestion.summaryChanges')}</dt>
              <dd>{summary.changes}</dd>
            </>
          )}
          {typeof summary.line_items === 'number' && (
            <>
              <dt className="text-slate-500">{t('ingestion.lines')}</dt>
              <dd>{summary.line_items}</dd>
            </>
          )}
          {summary.supplierName != null && String(summary.supplierName).trim() !== '' && (
            <>
              <dt className="text-slate-500">{t('ingestion.summary.supplierName')}</dt>
              <dd className="break-words">{String(summary.supplierName)}</dd>
            </>
          )}
          {summary.supplierId != null && String(summary.supplierId).trim() !== '' && (
            <>
              <dt className="text-slate-500">{t('ingestion.summary.supplierId')}</dt>
              <dd className="text-[11px] text-slate-600" title={String(summary.supplierId)}>
                {shortenId(summary.supplierId)}
              </dd>
            </>
          )}
          {'hadPreviousPriceList' in summary && (
            <>
              <dt className="text-slate-500">{t('ingestion.summary.hadPreviousPriceList')}</dt>
              <dd>{boolLabel(summary.hadPreviousPriceList, t)}</dd>
            </>
          )}
        </dl>

        {extraSummary.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-1.5 text-slate-500">{t('ingestion.summary.extraFields')}</div>
            <ul className="space-y-2 text-[11px] text-slate-700">
              {extraSummary.map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium text-slate-800">
                    {k.replace(/_/g, ' ')}
                    :{' '}
                  </span>
                  <span className="break-words">{formatExtraSummaryValue(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
