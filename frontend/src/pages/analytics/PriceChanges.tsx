import { useState, useEffect, useCallback } from 'react';
import { api, type PriceChange, type Supplier } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { displayProductName } from '../../lib/displayProductName';

export default function PriceChanges() {
  const t = useT();
  const bp = useBreakpoint();
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<string>('');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (supplierId) params.supplierId = supplierId;
      if (priorityOnly) params.priorityOnly = 'true';
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const [changesRes, suppliersRes] = await Promise.all([
        api.priceChanges(params),
        api.suppliers(),
      ]);
      setChanges(changesRes.changes);
      setSuppliers(suppliersRes.suppliers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supplierId, priorityOnly, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-800">{t('nav.prices')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('nav.pricesDescription')}</p>
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]"
        >
          <option value="">{t('dashboard.allSuppliers')}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={priorityOnly}
            onChange={(e) => setPriorityOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          {t('dashboard.priorityOnly')}
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="py-8 text-center text-slate-500">{t('dashboard.loading')}</div>
        ) : changes.length === 0 ? (
          <div className="py-8 text-center text-slate-500">{t('dashboard.noPriceChanges')}</div>
        ) : bp === 'mobile' ? (
          <div className="flex flex-col gap-2 p-3">
            {changes.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border border-[var(--border)] p-3 ${c.is_priority ? 'bg-amber-50/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{displayProductName(c.product_name)}</p>
                  <span
                    className={`shrink-0 text-lg font-bold ${
                      c.change_percent > 0 ? 'text-red-600' : c.change_percent < 0 ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  >
                    {c.change_percent > 0 ? '+' : ''}
                    {c.change_percent.toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{c.supplier_name}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {c.old_price} → {c.new_price} · {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-700">{t('dashboard.product')}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">{t('dashboard.supplier')}</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">{t('dashboard.old')}</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">{t('dashboard.new')}</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">{t('dashboard.changePercent')}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">{t('dashboard.date')}</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr
                    key={c.id}
                    className={`h-12 border-b border-slate-100 md:h-14 ${c.is_priority ? 'bg-amber-50/50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{displayProductName(c.product_name)}</span>
                      {c.is_priority && (
                        <span className="ml-2 text-xs text-amber-600">{t('dashboard.priority')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.supplier_name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.old_price}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{c.new_price}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        c.change_percent > 0
                          ? 'text-red-600'
                          : c.change_percent < 0
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                      }`}
                    >
                      {c.change_percent > 0 ? '+' : ''}
                      {c.change_percent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
