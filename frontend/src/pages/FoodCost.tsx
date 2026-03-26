import { useEffect, useState } from 'react';
import { request } from '../api/client';
import { useT } from '../i18n/LocaleContext';

type FoodcostForecastRow = {
  dish: string;
  current_cost: number;
  forecast_cost_30d: number;
  margin_change: number;
  selling_price: number;
};

export default function FoodCost() {
  const t = useT();
  const [rows, setRows] = useState<FoodcostForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    request<{ forecast: FoodcostForecastRow[] }>('/foodcost/forecast')
      .then((r) => {
        if (!cancelled) setRows(r.forecast ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load foodcost forecast');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const num = (v: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('foodcost.title')}</h1>
      <p className="text-slate-600">{t('foodcost.description')}</p>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Недостаточно данных для прогноза фудкоста. Добавьте рецепты и загрузите прайс-листы.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Блюдо</th>
                  <th className="px-4 py-3 text-left font-medium">Себестоимость (текущая)</th>
                  <th className="px-4 py-3 text-left font-medium">Себестоимость (30д прогноз)</th>
                  <th className="px-4 py-3 text-left font-medium">Цена продажи</th>
                  <th className="px-4 py-3 text-left font-medium">Изменение маржи</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, idx) => (
                  <tr key={`${r.dish}-${idx}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.dish}</td>
                    <td className="px-4 py-3">{num(r.current_cost)}</td>
                    <td className="px-4 py-3">{num(r.forecast_cost_30d)}</td>
                    <td className="px-4 py-3">{num(r.selling_price)}</td>
                    <td className={`px-4 py-3 ${r.margin_change < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {num(r.margin_change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
