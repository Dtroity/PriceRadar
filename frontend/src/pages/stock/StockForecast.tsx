import { useState, useEffect } from 'react';
import { request } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';

interface ForecastRow {
  product: string;
  product_id: string;
  stock_today: number;
  days_remaining: number;
  recommended_order_quantity: number;
  recommended_order_date: string | null;
}

export default function StockForecast() {
  const t = useT();
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    request<{ forecast: ForecastRow[] }>('/stock/forecast')
      .then((r) => setForecast(r.forecast))
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">{t('stock.forecast')}</h1>
      <p className="text-slate-600">{t('stock.forecastDescription')}</p>
      {err && <div className="rounded-lg bg-amber-50 p-3 text-sm">{err}</div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-3 py-2 text-left">{t('stock.product')}</th>
              <th className="px-3 py-2 text-right">{t('stock.stockToday')}</th>
              <th className="px-3 py-2 text-right">{t('stock.daysLeft')}</th>
              <th className="px-3 py-2 text-right">{t('stock.orderQty')}</th>
              <th className="px-3 py-2 text-right">{t('stock.orderDate')}</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((row) => (
              <tr key={row.product_id} className="border-b border-slate-100">
                <td className="px-3 py-2">{row.product}</td>
                <td className="px-3 py-2 text-right">{row.stock_today}</td>
                <td className="px-3 py-2 text-right">{row.days_remaining}</td>
                <td className="px-3 py-2 text-right">{row.recommended_order_quantity || '—'}</td>
                <td className="px-3 py-2 text-right">{row.recommended_order_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
