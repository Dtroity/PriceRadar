import { useEffect, useState } from 'react';
import { api, type Supplier } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';

export default function AutomationRules() {
  const t = useT();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filtersBySupplier, setFiltersBySupplier] = useState<Record<string, Array<{ id: string; keyword: string }>>>({});
  const [newKeywordBySupplier, setNewKeywordBySupplier] = useState<Record<string, string>>({});
  const [supplierQuery, setSupplierQuery] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'filters_desc' | 'filters_asc'>('filters_desc');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .suppliers()
      .then(async (r) => {
        const list = r.suppliers ?? [];
        setSuppliers(list);
        const filtersPairs = await Promise.all(
          list.map(async (s) => {
            const resp = await api.supplier.filters.list(s.id);
            return [s.id, resp.filters] as const;
          })
        );
        setFiltersBySupplier(Object.fromEntries(filtersPairs));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')));
  }, []);

  const addFilter = async (supplierId: string) => {
    const keyword = (newKeywordBySupplier[supplierId] ?? '').trim();
    if (!keyword) return;
    try {
      const created = await api.supplier.filters.add(supplierId, keyword);
      setFiltersBySupplier((prev) => ({
        ...prev,
        [supplierId]: [...(prev[supplierId] ?? []), created],
      }));
      setNewKeywordBySupplier((prev) => ({ ...prev, [supplierId]: '' }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  const removeFilter = async (supplierId: string, filterId: string) => {
    try {
      await api.supplier.filters.remove(supplierId, filterId);
      setFiltersBySupplier((prev) => ({
        ...prev,
        [supplierId]: (prev[supplierId] ?? []).filter((f) => f.id !== filterId),
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Закупки · Фильтры товаров</h1>
      <p className="text-slate-600">
        Определите по каждому поставщику, какие товары могут попадать в заказ. Добавляйте ключевые слова
        (как в AZBot): если позиция содержит ключевое слово, она допускается для выбранного поставщика.
      </p>
      {err && <div className="rounded-lg bg-amber-50 p-3 text-sm">{err}</div>}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            type="text"
            value={supplierQuery}
            onChange={(e) => setSupplierQuery(e.target.value)}
            placeholder="Поиск по поставщику"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={keywordQuery}
            onChange={(e) => setKeywordQuery(e.target.value)}
            placeholder="Поиск по ключевому слову"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as 'name' | 'filters_desc' | 'filters_asc')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="filters_desc">Сначала с большим числом фильтров</option>
            <option value="filters_asc">Сначала с меньшим числом фильтров</option>
            <option value="name">По имени поставщика</option>
          </select>
        </div>
      </div>
      {suppliers.length === 0 ? (
        <p className="text-slate-500">Поставщики не найдены.</p>
      ) : (
        <div className="space-y-3">
          {suppliers
            .filter((s) => s.name.toLowerCase().includes(supplierQuery.trim().toLowerCase()))
            .filter((s) => {
              const kq = keywordQuery.trim().toLowerCase();
              if (!kq) return true;
              return (filtersBySupplier[s.id] ?? []).some((f) => f.keyword.toLowerCase().includes(kq));
            })
            .sort((a, b) => {
              if (sortMode === 'name') return a.name.localeCompare(b.name);
              const fa = (filtersBySupplier[a.id] ?? []).length;
              const fb = (filtersBySupplier[b.id] ?? []).length;
              return sortMode === 'filters_asc' ? fa - fb : fb - fa;
            })
            .map((s) => {
              const filters = filtersBySupplier[s.id] ?? [];
            return (
              <section key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium text-slate-900">{s.name}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    Фильтров: {filters.length}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newKeywordBySupplier[s.id] ?? ''}
                    onChange={(e) =>
                      setNewKeywordBySupplier((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="Например: сыр, молоко, йогурт"
                    className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
                    onClick={() => void addFilter(s.id)}
                  >
                    Добавить фильтр
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {filters.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                    >
                      {f.keyword}
                      <button
                        type="button"
                        className="text-slate-500 hover:text-red-600"
                        onClick={() => void removeFilter(s.id, f.id)}
                        aria-label="Удалить фильтр"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {filters.length === 0 && <span className="text-sm text-slate-500">Фильтров пока нет</span>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
