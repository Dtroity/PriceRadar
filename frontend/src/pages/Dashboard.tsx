import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, type PriceChange } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import UnifiedIngestionUpload from '../components/UnifiedIngestionUpload';
import { displayProductName } from '../lib/displayProductName';

export default function Dashboard() {
  const t = useT();
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.priceChanges();
      setChanges(res.changes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview, refreshKey]);

  const priorityChanges = changes.filter((c) => c.is_priority);
  const increases = changes
    .filter((c) => c.change_percent > 0)
    .sort((a, b) => b.change_percent - a.change_percent);
  const decreases = changes
    .filter((c) => c.change_percent < 0)
    .sort((a, b) => a.change_percent - b.change_percent);
  const preview = changes.slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="py-4 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-800">{t('app.name')}</h1>
        <p className="mt-1 text-slate-600">{t('app.tagline')}</p>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">{t('app.welcomeDescription')}</p>
      </header>

      <UnifiedIngestionUpload onCompleted={() => setRefreshKey((k) => k + 1)} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
          <p className="text-xs text-slate-500 md:text-sm">{t('dashboard.priorityChanges')}</p>
          <p className="text-xl font-semibold text-amber-600 md:text-2xl">{priorityChanges.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
          <p className="text-xs text-slate-500 md:text-sm">{t('dashboard.largestIncrease')}</p>
          <p className="text-xl font-semibold text-red-600 md:text-2xl">
            {increases[0] ? `+${increases[0].change_percent.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 md:col-span-1 md:p-4">
          <p className="text-xs text-slate-500 md:text-sm">{t('dashboard.largestDecrease')}</p>
          <p className="text-xl font-semibold text-emerald-600 md:text-2xl">
            {decreases[0] ? `${decreases[0].change_percent.toFixed(1)}%` : '—'}
          </p>
        </div>
      </section>

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{t('dashboard.recentChanges')}</h2>
        <Link
          to="/analytics/prices"
          className="text-sm font-medium text-amber-800 underline decoration-amber-800/40 hover:text-amber-950"
        >
          {t('dashboard.openFullPriceList')} →
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="py-8 text-center text-slate-500">{t('dashboard.loading')}</div>
        ) : preview.length === 0 ? (
          <div className="py-8 text-center text-slate-500">{t('dashboard.noPriceChanges')}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {preview.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{displayProductName(c.product_name)}</p>
                  <p className="truncate text-xs text-slate-500">{c.supplier_name}</p>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    c.change_percent > 0 ? 'text-red-600' : c.change_percent < 0 ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                >
                  {c.change_percent > 0 ? '+' : ''}
                  {c.change_percent.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
