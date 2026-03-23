import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  acknowledgeAnomaly,
  fetchAnomalies,
  type AnomalyRow,
} from '../../api/analyticsClient';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useLocale } from '../../i18n/LocaleContext';
import { cn } from '../../lib/cn';

export default function AnomaliesPage() {
  const { t } = useLocale();
  const bp = useBreakpoint();
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>('');
  const [ackFilter, setAckFilter] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ack =
        ackFilter === 'new' ? false : ackFilter === 'done' ? true : undefined;
      const data = await fetchAnomalies({
        severity: severity || undefined,
        acknowledged: ack,
        limit: 200,
      });
      setRows(data.anomalies);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [severity, ackFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAck = async (id: string) => {
    setBusy(id);
    try {
      await acknowledgeAnomaly(id);
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  const sevBorder = (s: string) => {
    if (s === 'high') return 'border-l-red-500';
    if (s === 'medium') return 'border-l-orange-500';
    return 'border-l-amber-400';
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">Аномалии цен</h1>
        <Link to="/analytics?tab=summary" className="tap-target-row text-sm text-slate-600 underline">
          ← К аналитике
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">Все severity</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <select
          value={ackFilter}
          onChange={(e) => setAckFilter(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">Все статусы</option>
          <option value="new">Новые</option>
          <option value="done">Просмотренные</option>
        </select>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border bg-slate-50" />
      ) : bp === 'mobile' ? (
        <div className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-slate-500">Нет записей</p>
          ) : (
            rows.map((r) => {
              const up = r.direction === 'up';
              const pct = parseFloat(String(r.change_pct)) || 0;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'rounded-xl border border-[var(--border)] border-l-4 bg-white p-4 shadow-sm',
                    sevBorder(r.severity)
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.product_name ?? r.product_id}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{r.supplier_name ?? '—'}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-xl font-bold',
                        up ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                      )}
                    >
                      {up ? '+' : ''}
                      {pct}%
                    </span>
                  </div>
                  {!r.acknowledged && (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      className="mt-3 text-sm font-medium text-amber-800 disabled:opacity-50"
                      onClick={() => onAck(r.id)}
                    >
                      {busy === r.id ? '…' : t('anomalies.markSeen')}
                    </button>
                  )}
                  {r.document_id && (
                    <Link
                      to={`/documents/${r.document_id}`}
                      className="mt-2 inline-block text-sm text-blue-700 underline"
                    >
                      Документ
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-3 py-2">Товар</th>
                <th className="px-3 py-2">Поставщик</th>
                <th className="px-3 py-2">Было</th>
                <th className="px-3 py-2">Стало</th>
                <th className="px-3 py-2">Δ %</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Нет записей
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="h-12 border-b border-slate-100 md:h-14">
                    <td className="px-3 py-2">{r.product_name ?? r.product_id}</td>
                    <td className="px-3 py-2">{r.supplier_name ?? '—'}</td>
                    <td className="px-3 py-2">{r.price_before}</td>
                    <td className="px-3 py-2">{r.price_after}</td>
                    <td className="px-3 py-2">{r.change_pct}%</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{r.severity}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{new Date(r.detected_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.acknowledged ? 'Просмотрено' : 'Новая'}</td>
                    <td className="px-3 py-2">
                      {!r.acknowledged && (
                        <button
                          type="button"
                          disabled={busy === r.id}
                          className="table-action-icon text-xs text-slate-700 underline disabled:opacity-50"
                          onClick={() => onAck(r.id)}
                        >
                          {busy === r.id ? '…' : t('anomalies.markShort')}
                        </button>
                      )}
                      {r.document_id && (
                        <Link to={`/documents/${r.document_id}`} className="ml-2 text-xs text-blue-700 underline">
                          Док.
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
