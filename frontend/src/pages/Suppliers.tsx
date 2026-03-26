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

export default function Suppliers({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'filters_desc' | 'filters_asc'>('name');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
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
  const visibleSuppliers = suppliers
    .filter((s) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const email = String((s as any).email ?? '').toLowerCase();
      const contact = String((s as any).contact_name ?? '').toLowerCase();
      return s.name.toLowerCase().includes(q) || email.includes(q) || contact.includes(q);
    })
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const fa = Number((a as any).filters_count ?? 0);
      const fb = Number((b as any).filters_count ?? 0);
      return sort === 'filters_asc' ? fa - fb : fb - fa;
    });

  const onSupplierUpdated = (s: Supplier) => {
    setSuppliers((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...s } : p)));
    setSelected((prev) => (prev?.id === s.id ? { ...prev, ...s } : prev));
  };

  const addSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.supplier.create(name);
      setSuppliers((prev) => {
        if (prev.some((s) => s.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      setNewSupplierName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create supplier');
    } finally {
      setCreating(false);
    }
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
      {!embedded && (
        <>
          <h1 className="text-xl font-semibold text-slate-800">{t('suppliers.title')}</h1>
          <p className="text-slate-600">{t('suppliers.description')}</p>
        </>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            placeholder="Новый поставщик"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={creating || !newSupplierName.trim()}
            onClick={() => void addSupplier()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {creating ? 'Добавление…' : 'Добавить поставщика'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b text-sm text-slate-600">
          {loading ? 'Загрузка…' : `Поставщиков: ${suppliers.length}`}
        </div>
        <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск поставщика, email или контакта"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'name' | 'filters_desc' | 'filters_asc')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="name">Сортировка: по имени</option>
            <option value="filters_desc">Сортировка: больше фильтров сверху</option>
            <option value="filters_asc">Сортировка: меньше фильтров сверху</option>
          </select>
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
              {visibleSuppliers.map((s) => {
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
              {!loading && visibleSuppliers.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Поставщики не найдены по заданному фильтру
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
