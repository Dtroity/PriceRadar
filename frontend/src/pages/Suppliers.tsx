import { useEffect, useMemo, useState } from 'react';
import { api, type Supplier } from '../api/client';
import SupplierPanel from './suppliers/SupplierPanel';
import { useT } from '../i18n/LocaleContext';

function badge(className: string, text: string) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {text}
    </span>
  );
}

export default function Suppliers() {
  const t = useT();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Supplier | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .suppliers()
      .then((r) => {
        if (!cancelled) setSuppliers(r.suppliers ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const selectedFresh = selected ? byId.get(selected.id) ?? selected : null;

  const onSupplierUpdated = (s: Supplier) => {
    setSuppliers((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...s } : p)));
    setSelected((prev) => (prev?.id === s.id ? { ...prev, ...s } : prev));
  };

  const channelBadge = (s: Supplier) => {
    const ch = (s as any).notify_channel ?? 'email';
    if (ch === 'email') return badge('bg-blue-50 text-blue-700', 'Email');
    if (ch === 'telegram') return badge('bg-violet-50 text-violet-700', 'TG');
    if (ch === 'both') return badge('bg-indigo-50 text-indigo-700', 'Оба');
    if (ch === 'none') return badge('bg-slate-100 text-slate-600', 'Нет');
    return badge('bg-slate-100 text-slate-600', String(ch));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('suppliers.title')}</h1>
      <p className="text-slate-600">{t('suppliers.description')}</p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b text-sm text-slate-600">
          {loading ? 'Загрузка…' : `Поставщиков: ${suppliers.length}`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-medium px-4 py-3">Поставщик</th>
                <th className="text-left font-medium px-4 py-3">Контакт</th>
                <th className="text-left font-medium px-4 py-3">Email</th>
                <th className="text-left font-medium px-4 py-3">Канал</th>
                <th className="text-left font-medium px-4 py-3">Фильтры</th>
                <th className="text-left font-medium px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.map((s) => {
                const filtersCount = Number((s as any).filters_count ?? 0);
                const active = Boolean((s as any).is_active ?? true);
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-amber-50/50 cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-slate-700">{(s as any).contact_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {(s as any).email ? (
                        (s as any).email
                      ) : (
                        <span className="inline-flex items-center gap-2 text-slate-500">
                          — <span className="text-amber-600">●</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{channelBadge(s)}</td>
                    <td className="px-4 py-3">
                      {filtersCount > 0
                        ? badge('bg-slate-100 text-slate-700', `${filtersCount} слов`)
                        : badge('bg-amber-50 text-amber-800', 'Нет фильтров')}
                    </td>
                    <td className="px-4 py-3">
                      {active
                        ? badge('bg-emerald-50 text-emerald-700', 'Активен')
                        : badge('bg-slate-100 text-slate-600', 'Деактивирован')}
                    </td>
                  </tr>
                );
              })}
              {!loading && suppliers.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Поставщики не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SupplierPanel
        open={Boolean(selected)}
        supplier={selectedFresh}
        onClose={() => setSelected(null)}
        onSupplierUpdated={onSupplierUpdated}
      />
    </div>
  );
}
