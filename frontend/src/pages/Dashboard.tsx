import { useState, useEffect, useCallback } from 'react';
import { api, type PriceChange, type Supplier } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import UploadZone from '../components/UploadZone';

export default function Dashboard() {
  const t = useT();
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

  const priorityChanges = changes.filter((c) => c.is_priority);
  const increases = changes.filter((c) => c.change_percent > 0).sort((a, b) => b.change_percent - a.change_percent);
  const decreases = changes.filter((c) => c.change_percent < 0).sort((a, b) => a.change_percent - b.change_percent);

  return (
    <div className="space-y-6">
      <header className="text-center py-4">
        <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-wide">{t('app.name')}</h1>
        <p className="text-slate-600 mt-1">{t('app.tagline')}</p>
        <p className="text-sm text-slate-500 mt-3 max-w-2xl mx-auto">{t('app.welcomeDescription')}</p>
      </header>

      <UploadZone onUpload={load} />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">{t('dashboard.priorityChanges')}</p>
          <p className="text-2xl font-semibold text-amber-600">{priorityChanges.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">{t('dashboard.largestIncrease')}</p>
          <p className="text-2xl font-semibold text-red-600">
            {increases[0] ? `+${increases[0].change_percent.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">{t('dashboard.largestDecrease')}</p>
          <p className="text-2xl font-semibold text-emerald-600">
            {decreases[0] ? `${decreases[0].change_percent.toFixed(1)}%` : '—'}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-700">{t('dashboard.product')}</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">{t('dashboard.supplier')}</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">{t('dashboard.old')}</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">{t('dashboard.new')}</th>
                <th className="text-right py-3 px-4 font-medium text-slate-700">{t('dashboard.changePercent')}</th>
                <th className="text-left py-3 px-4 font-medium text-slate-700">{t('dashboard.date')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    {t('dashboard.loading')}
                  </td>
                </tr>
              ) : changes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    {t('dashboard.noPriceChanges')}
                  </td>
                </tr>
              ) : (
                changes.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-100 ${
                      c.is_priority ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{c.product_name}</span>
                      {c.is_priority && (
                        <span className="ml-2 text-amber-600 text-xs">{t('dashboard.priority')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{c.supplier_name}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{c.old_price}</td>
                    <td className="py-3 px-4 text-right text-slate-800">{c.new_price}</td>
                    <td
                      className={`py-3 px-4 text-right font-medium ${
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
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
