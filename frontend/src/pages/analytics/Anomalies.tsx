import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  acknowledgeAnomaly,
  fetchAnomalies,
  type AnomalyRow,
} from '../../api/analyticsClient';

export default function AnomaliesPage() {
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

  const sevClass = (s: string) => {
    if (s === 'high') return 'text-red-700 bg-red-50';
    if (s === 'medium') return 'text-orange-800 bg-orange-50';
    return 'text-amber-800 bg-amber-50';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-800">Аномалии цен</h1>
        <Link to="/analytics?tab=summary" className="text-sm text-slate-600 underline">
          ← К аналитике
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center text-sm">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">Все severity</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <select
          value={ackFilter}
          onChange={(e) => setAckFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">Все статусы</option>
          <option value="new">Новые</option>
          <option value="done">Просмотренные</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-slate-50 h-64 animate-pulse" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="py-2 px-3">Товар</th>
                <th className="py-2 px-3">Поставщик</th>
                <th className="py-2 px-3">Было</th>
                <th className="py-2 px-3">Стало</th>
                <th className="py-2 px-3">Δ %</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Дата</th>
                <th className="py-2 px-3">Статус</th>
                <th className="py-2 px-3"></th>
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
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 px-3">{r.product_name ?? r.product_id}</td>
                    <td className="py-2 px-3">{r.supplier_name ?? '—'}</td>
                    <td className="py-2 px-3">{r.price_before}</td>
                    <td className="py-2 px-3">{r.price_after}</td>
                    <td className="py-2 px-3">{r.change_pct}%</td>
                    <td className="py-2 px-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${sevClass(r.severity)}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {new Date(r.detected_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">{r.acknowledged ? 'Просмотрено' : 'Новая'}</td>
                    <td className="py-2 px-3">
                      {!r.acknowledged && (
                        <button
                          type="button"
                          disabled={busy === r.id}
                          className="text-xs text-slate-700 underline disabled:opacity-50"
                          onClick={() => onAck(r.id)}
                        >
                          {busy === r.id ? '…' : 'Отметить'}
                        </button>
                      )}
                      {r.document_id && (
                        <Link
                          to={`/documents/${r.document_id}`}
                          className="ml-2 text-xs text-blue-700 underline"
                        >
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
