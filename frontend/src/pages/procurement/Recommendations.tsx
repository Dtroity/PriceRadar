import { useState } from 'react';
import { request } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';

export default function ProcurementRecommendations() {
  const t = useT();
  const [data, setData] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(null);
    request<unknown>('/ai-procurement-agent/recommendations', {
      method: 'POST',
      body: JSON.stringify({}),
    })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Procurement · {t('procurement.recommendations')}</h1>
      <p className="text-slate-600">{t('procurement.recommendationsDescription')}</p>
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? t('common.loading') : t('procurement.runRecommendations')}
      </button>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {data != null ? (
        <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
