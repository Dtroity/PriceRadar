import { Link } from 'react-router-dom';
import type { PriceSummaryResponse } from '../../api/analyticsClient';
import { useLocale } from '../../i18n/LocaleContext';

type Props = {
  data: PriceSummaryResponse | null;
  loading: boolean;
  periodDays: number;
  onProductClick: (productId: string) => void;
  anomalyCount?: number;
};

export default function PriceSummaryCards({
  data,
  loading,
  periodDays,
  onProductClick,
  anomalyCount,
}: Props) {
  const { t } = useLocale();

  if (loading) {
    return <div className="grid md:grid-cols-2 gap-4">{[1, 2].map((i) => (
      <div key={i} className="h-64 rounded-xl bg-slate-100 animate-pulse" />
    ))}</div>;
  }

  const growing = data?.top_growing ?? [];
  const falling = data?.top_falling ?? [];
  const ac = anomalyCount ?? data?.anomalies_count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/analytics/anomalies"
          className="inline-flex items-center rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
        >
          Аномалии ({ac})
        </Link>
        <span className="text-sm text-slate-500">
          Товаров с историей за {periodDays} дн.: {data?.total_products_tracked ?? 0}
        </span>
      </div>
      <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">{t('analytics.summaryPerSupplier')}</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
          <h3 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
            <span aria-hidden>↑</span> Топ роста цены
          </h3>
          <ul className="space-y-2">
            {growing.length === 0 && <li className="text-slate-500 text-sm">Нет данных</li>}
            {growing.map((g) => (
              <li key={g.product.id}>
                <button
                  type="button"
                  className="w-full text-left flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/80"
                  onClick={() => onProductClick(g.product.id)}
                >
                  <span className="text-slate-800">{g.product.name}</span>
                  <span className="text-red-700 font-medium">+{g.change_pct.toFixed(1)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <h3 className="font-semibold text-emerald-900 flex items-center gap-2 mb-3">
            <span aria-hidden>↓</span> Топ падения цены
          </h3>
          <ul className="space-y-2">
            {falling.length === 0 && <li className="text-slate-500 text-sm">Нет данных</li>}
            {falling.map((g) => (
              <li key={g.product.id}>
                <button
                  type="button"
                  className="w-full text-left flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/80"
                  onClick={() => onProductClick(g.product.id)}
                >
                  <span className="text-slate-800">{g.product.name}</span>
                  <span className="text-emerald-800 font-medium">{g.change_pct.toFixed(1)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
