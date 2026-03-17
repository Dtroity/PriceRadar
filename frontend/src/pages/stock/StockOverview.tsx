import { useState, useEffect } from 'react';
import { request } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';

interface StockRow {
  product: string;
  product_id: string;
  current_stock: number;
  unit: string | null;
  daily_consumption: number;
  days_remaining: number;
}

export default function StockOverview() {
  const t = useT();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    request<{ stock: StockRow[] }>('/stock')
      .then((r) => setStock(r.stock))
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">{t('stock.overview')}</h1>
      <p className="text-slate-600">{t('stock.overviewDescription')}</p>
      {err && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{err}</div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-3 py-2 text-left">{t('stock.product')}</th>
              <th className="px-3 py-2 text-right">{t('stock.currentStock')}</th>
              <th className="px-3 py-2 text-right">{t('stock.dailyUse')}</th>
              <th className="px-3 py-2 text-right">{t('stock.daysLeft')}</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((row) => (
              <tr key={row.product_id} className="border-b border-slate-100">
                <td className="px-3 py-2">{row.product}</td>
                <td className="px-3 py-2 text-right">{row.current_stock} {row.unit ?? 'kg'}</td>
                <td className="px-3 py-2 text-right">{row.daily_consumption.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{row.days_remaining < 5 ? <span className="text-amber-600">{row.days_remaining}</span> : row.days_remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stock.length === 0 && !err && <div className="p-8 text-center text-slate-500">{t('stock.noStockData')}</div>}
      </div>
    </div>
  );
}
