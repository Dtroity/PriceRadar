import { useMemo, useState } from 'react';
import type { BestSuppliersResponse } from '../../api/analyticsClient';

type Col = 'name' | 'avg_price' | 'min_price' | 'delivery_count' | 'price_stability' | 'score';

type Props = {
  data: BestSuppliersResponse | null;
  loading: boolean;
  onSupplierClick?: (supplierId: string) => void;
};

export default function SupplierRankingTable({ data, loading, onSupplierClick }: Props) {
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

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {(
              [
                ['name', 'Поставщик'],
                ['avg_price', 'Средняя цена'],
                ['min_price', 'Мин. цена'],
                ['delivery_count', 'Поставок'],
                ['price_stability', 'Стабильность'],
                ['score', 'Рейтинг'],
              ] as const
            ).map(([key, label]) => (
              <th key={key} className="text-left py-2 px-3">
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
                Нет данных за период
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.supplier.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 px-3">
                  <button
                    type="button"
                    className="text-left text-slate-800 underline-offset-2 hover:underline"
                    onClick={() => onSupplierClick?.(r.supplier.id)}
                  >
                    {r.supplier.name}
                  </button>
                </td>
                <td className="py-2 px-3">{r.avg_price.toFixed(2)}</td>
                <td className="py-2 px-3">{r.min_price.toFixed(2)}</td>
                <td className="py-2 px-3">{r.delivery_count}</td>
                <td className="py-2 px-3 w-40">
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.round(r.price_stability * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{(r.price_stability * 100).toFixed(0)}%</span>
                </td>
                <td className={`py-2 px-3 font-semibold ${scoreColor(r.score)}`}>{r.score}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
