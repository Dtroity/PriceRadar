import { useMemo, useState } from 'react';
import type { BestSuppliersResponse } from '../../api/analyticsClient';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useT } from '../../i18n/LocaleContext';

type Col = 'name' | 'avg_price' | 'min_price' | 'delivery_count' | 'price_stability' | 'score';

type Props = {
  data: BestSuppliersResponse | null;
  loading: boolean;
  onSupplierClick?: (supplierId: string) => void;
};

export default function SupplierRankingTable({ data, loading, onSupplierClick }: Props) {
  const t = useT();
  const bp = useBreakpoint();
  const [sortCol, setSortCol] = useState<Col>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rows = useMemo(() => {
    const list = data?.suppliers ?? [];
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortCol) {
        case 'name':
          return mul * a.supplier.name.localeCompare(b.supplier.name);
        case 'avg_price':
          return mul * (a.avg_price - b.avg_price);
        case 'min_price':
          return mul * (a.min_price - b.min_price);
        case 'delivery_count':
          return mul * (a.delivery_count - b.delivery_count);
        case 'price_stability':
          return mul * (a.price_stability - b.price_stability);
        case 'score':
        default:
          return mul * (a.score - b.score);
      }
    });
  }, [data, sortCol, sortDir]);

  const toggle = (c: Col) => {
    if (sortCol === c) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(c);
      setSortDir(c === 'name' ? 'asc' : 'desc');
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 70) return 'text-green-700';
    if (s >= 40) return 'text-amber-700';
    return 'text-red-700';
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 h-48 animate-pulse" />;
  }

  if (bp === 'mobile') {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left">{t('supplierRanking.supplier')}</th>
              <th className="px-3 py-2 text-right">{t('supplierRanking.avg')}</th>
              <th className="px-3 py-2 text-right">{t('supplierRanking.score')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-500">
                  {t('supplierRanking.noData')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.supplier.id} className="h-14 border-b border-slate-100">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="min-h-[44px] text-left text-slate-800 underline-offset-2 hover:underline"
                      onClick={() => onSupplierClick?.(r.supplier.id)}
                    >
                      {r.supplier.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.avg_price.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${scoreColor(r.score)}`}>{r.score}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {(
              [
                ['name', t('supplierRanking.supplier')],
                ['avg_price', t('supplierRanking.avgPrice')],
                ['min_price', t('supplierRanking.minPrice')],
                ['delivery_count', t('supplierRanking.deliveries')],
                ['price_stability', t('supplierRanking.stability')],
                ['score', t('supplierRanking.score')],
              ] as const
            ).map(([key, label]) => (
              <th key={key} className="px-3 py-2 text-left">
                <button
                  type="button"
                  className="font-medium text-slate-700 hover:text-slate-900"
                  onClick={() => toggle(key)}
                >
                  {label}
                  {sortCol === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-500">
                {t('supplierRanking.noData')}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.supplier.id} className="h-12 border-b border-slate-100 hover:bg-slate-50 md:h-14">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left text-slate-800 underline-offset-2 hover:underline"
                    onClick={() => onSupplierClick?.(r.supplier.id)}
                  >
                    {r.supplier.name}
                  </button>
                </td>
                <td className="px-3 py-2">{r.avg_price.toFixed(2)}</td>
                <td className="px-3 py-2">{r.min_price.toFixed(2)}</td>
                <td className="px-3 py-2">{r.delivery_count}</td>
                <td className="w-40 px-3 py-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.round(r.price_stability * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{(r.price_stability * 100).toFixed(0)}%</span>
                </td>
                <td className={`px-3 py-2 font-semibold ${scoreColor(r.score)}`}>{r.score}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
