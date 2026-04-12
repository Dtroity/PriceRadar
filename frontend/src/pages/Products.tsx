import { useEffect, useMemo, useState } from 'react';
import { api, type Product, type ProductAuditEntry, type ProductNormalizationItem } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import { displayProductName } from '../lib/displayProductName';

function fillTemplate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export default function Products() {
  const t = useT();
  const [items, setItems] = useState<ProductNormalizationItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [mergeSources, setMergeSources] = useState<Record<string, boolean>>({});
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeMessage, setMergeMessage] = useState('');

  const [duplicatePairs, setDuplicatePairs] = useState<
    Array<{ product1: Product; product2: Product; similarity: number }>
  >([]);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState('');
  const [dupMessage, setDupMessage] = useState('');

  const [historyProductId, setHistoryProductId] = useState('');
  const [historyRows, setHistoryRows] = useState<ProductAuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [productsSortKey, setProductsSortKey] = useState<'name' | 'id' | 'normalized_name'>('name');
  const [productsSortDir, setProductsSortDir] = useState<'asc' | 'desc'>('asc');

  const [intelTab, setIntelTab] = useState<'all' | 'favorites' | 'top'>('all');
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const displayedProducts = useMemo(() => {
    if (searchInput.trim()) {
      return searchResults ?? [];
    }
    if (intelTab === 'top') return topProducts;
    if (intelTab === 'favorites') return products.filter((p) => p.is_favorite);
    return products;
  }, [intelTab, products, topProducts, searchInput, searchResults]);

  useEffect(() => {
    const q = searchInput.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const handle = setTimeout(() => {
      setSearchLoading(true);
      api
        .productsSearch(q)
        .then((r) => setSearchResults(r.products))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (intelTab !== 'top') return;
    let cancelled = false;
    api.productsTop().then((r) => {
      if (!cancelled) setTopProducts(r.products);
    });
    return () => {
      cancelled = true;
    };
  }, [intelTab]);

  const toggleFavorite = async (p: Product) => {
    const next = !p.is_favorite;
    try {
      await api.patchProductFavorite(p.id, next);
      const patch = (prev: Product[]) =>
        prev.map((x) => (x.id === p.id ? { ...x, is_favorite: next } : x));
      setProducts(patch);
      setTopProducts(patch);
      setSearchResults((prev) => (prev == null ? prev : patch(prev)));
    } catch {
      /* ignore */
    }
  };
  const [itemsSortKey, setItemsSortKey] = useState<'raw_name' | 'normalized_name' | 'usage_count'>('usage_count');
  const [itemsSortDir, setItemsSortDir] = useState<'asc' | 'desc'>('desc');

  const selectedNames = useMemo(
    () => items.filter((i) => selected[i.id]).map((i) => i.raw_name),
    [items, selected]
  );

  const mergeSourceIds = useMemo(
    () => products.filter((p) => mergeSources[p.id]).map((p) => p.id),
    [products, mergeSources]
  );

  const thBtn = 'inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900';
  const sortArrow = (on: boolean, dir: 'asc' | 'desc') => (on ? (dir === 'asc' ? '↑' : '↓') : '');

  const sortedProducts = [...displayedProducts].sort((a, b) => {
    const mul = productsSortDir === 'asc' ? 1 : -1;
    if (productsSortKey === 'id') return a.id.localeCompare(b.id, 'ru') * mul;
    if (productsSortKey === 'normalized_name') {
      return displayProductName(a.normalized_name).localeCompare(displayProductName(b.normalized_name), 'ru') * mul;
    }
    return displayProductName(a.name).localeCompare(displayProductName(b.name), 'ru') * mul;
  });

  const onProductsSort = (k: typeof productsSortKey) => {
    if (productsSortKey !== k) {
      setProductsSortKey(k);
      setProductsSortDir(k === 'id' ? 'asc' : 'asc');
      return;
    }
    setProductsSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const sortedItems = [...items].sort((a, b) => {
    const mul = itemsSortDir === 'asc' ? 1 : -1;
    if (itemsSortKey === 'usage_count') return (a.usage_count - b.usage_count) * mul;
    if (itemsSortKey === 'normalized_name') {
      return displayProductName(a.normalized_name).localeCompare(displayProductName(b.normalized_name), 'ru') * mul;
    }
    return displayProductName(a.raw_name).localeCompare(displayProductName(b.raw_name), 'ru') * mul;
  });

  const onItemsSort = (k: typeof itemsSortKey) => {
    if (itemsSortKey !== k) {
      setItemsSortKey(k);
      setItemsSortDir(k === 'usage_count' ? 'desc' : 'asc');
      return;
    }
    setItemsSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.productNormalization.list();
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('products.errorNormalizeList'));
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setMergeLoading(true);
    setMergeError('');
    setMergeMessage('');
    try {
      const res = await api.products();
      setProducts(res.products);
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : t('products.errorLoadProducts'));
    } finally {
      setMergeLoading(false);
    }
  };

  const apply = async () => {
    if (!selectedNames.length || !target.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.productNormalization.apply(selectedNames, target);
      setSelected({});
      setTarget('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('products.errorNormalizeApply'));
    } finally {
      setLoading(false);
    }
  };

  const merge = async () => {
    const targetId = mergeTargetId.trim();
    const sources = mergeSourceIds.filter((id) => id !== targetId);
    if (!targetId) {
      setMergeError(t('products.mergePickTarget'));
      return;
    }
    if (!sources.length) {
      setMergeError(t('products.mergePickSources'));
      return;
    }
    setMergeLoading(true);
    setMergeError('');
    setMergeMessage('');
    try {
      const res = await api.productsMerge(sources, targetId);
      setMergeMessage(`${t('products.mergeSuccess')} ${res.mergedSourceIds.length}`);
      setMergeSources({});
      await loadProducts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('products.errorMerge');
      if (msg.toLowerCase().includes('forbidden') || msg.includes('403')) {
        setMergeError(t('products.mergeForbidden'));
      } else {
        setMergeError(msg);
      }
    } finally {
      setMergeLoading(false);
    }
  };

  const loadDuplicates = async () => {
    setDupLoading(true);
    setDupError('');
    setDupMessage('');
    try {
      const res = await api.getDuplicates();
      setDuplicatePairs(res.pairs);
    } catch (e) {
      setDupError(e instanceof Error ? e.message : t('products.errorDuplicates'));
    } finally {
      setDupLoading(false);
    }
  };

  const runAutoMerge = async () => {
    setDupLoading(true);
    setDupError('');
    setDupMessage('');
    try {
      const res = await api.autoMergeProducts();
      setDupMessage(fillTemplate(t('products.autoMergeResult'), { n: res.merged }));
      await loadDuplicates();
      await loadProducts();
    } catch (e) {
      setDupError(e instanceof Error ? e.message : t('products.errorAutoMerge'));
    } finally {
      setDupLoading(false);
    }
  };

  const mergeDuplicateRow = async (p1: Product, p2: Product) => {
    const t1 = new Date(p1.created_at).getTime();
    const t2 = new Date(p2.created_at).getTime();
    const [older, newer] = t1 <= t2 ? [p1, p2] : [p2, p1];
    setDupLoading(true);
    setDupError('');
    try {
      await api.productsMerge([newer.id], older.id);
      setDupMessage(
        fillTemplate(t('products.mergePairDone'), {
          from: displayProductName(newer.name),
          to: displayProductName(older.name),
        })
      );
      await loadDuplicates();
      await loadProducts();
    } catch (e) {
      setDupError(e instanceof Error ? e.message : t('products.errorMerge'));
    } finally {
      setDupLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!historyProductId) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await api.getProductHistory(historyProductId);
      setHistoryRows(res.history);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : t('products.errorHistory'));
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('products.title')}</h1>
      <p className="text-slate-600">{t('products.description')}</p>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-800">{t('products.mergeSection')}</h2>
        <p className="text-sm text-slate-600">{t('products.mergeDescription')}</p>
        <div className="flex flex-wrap gap-2 items-center border-b border-slate-100 pb-3 mb-2">
          {(['all', 'favorites', 'top'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setIntelTab(tab);
                setSearchInput('');
                setSearchResults(null);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                intelTab === tab && !searchInput.trim()
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab === 'all' && `📦 ${t('products.intelTabAll')}`}
              {tab === 'favorites' && `⭐ ${t('products.intelTabFavorites')}`}
              {tab === 'top' && `🔥 ${t('products.intelTabTop')}`}
            </button>
          ))}
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('products.searchPlaceholder')}
            className="min-w-[200px] flex-1 max-w-md px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
          {searchLoading && <span className="text-xs text-slate-500">{t('common.loading')}</span>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={loadProducts}
            disabled={mergeLoading}
            className="px-3 py-2 text-sm rounded bg-slate-800 text-white disabled:opacity-50"
          >
            {t('products.loadProducts')}
          </button>
          <label className="text-sm text-slate-600 flex items-center gap-2">
            <span>{t('products.mergeTarget')}:</span>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-sm min-w-[200px]"
            >
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayProductName(p.name)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={merge}
            disabled={
              mergeLoading || !mergeTargetId || mergeSourceIds.filter((id) => id !== mergeTargetId).length === 0
            }
            className="px-3 py-2 text-sm rounded bg-amber-700 text-white disabled:opacity-50"
          >
            {t('products.mergeButton')}
          </button>
        </div>
        {mergeError && <p className="text-sm text-red-600">{mergeError}</p>}
        {mergeMessage && <p className="text-sm text-emerald-700">{mergeMessage}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-2">{t('products.colIntel')}</th>
                <th className="text-left p-2">{t('products.mergeSources')}</th>
                <th className="text-left p-2">
                  <button type="button" className={thBtn} onClick={() => onProductsSort('id')}>
                    {t('products.colId')} {sortArrow(productsSortKey === 'id', productsSortDir)}
                  </button>
                </th>
                <th className="text-left p-2">
                  <button type="button" className={thBtn} onClick={() => onProductsSort('name')}>
                    {t('stock.product')} {sortArrow(productsSortKey === 'name', productsSortDir)}
                  </button>
                </th>
                <th className="text-left p-2">
                  <button type="button" className={thBtn} onClick={() => onProductsSort('normalized_name')}>
                    {t('products.colNormalized')} {sortArrow(productsSortKey === 'normalized_name', productsSortDir)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="p-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={mergeLoading}
                      onClick={() => void toggleFavorite(p)}
                      className="text-lg leading-none mr-1 align-middle"
                      title={t('products.intelTabFavorites')}
                      aria-pressed={p.is_favorite}
                    >
                      {p.is_favorite ? '⭐' : '☆'}
                    </button>
                    {(p.priority_score ?? 0) >= 35 && (
                      <span className="text-base" title={`${t('products.scoreShort')}: ${(p.priority_score ?? 0).toFixed(1)}`}>
                        🔥
                      </span>
                    )}
                    <span className="text-xs text-slate-500 ml-1">
                      {(p.priority_score ?? 0) > 0 ? (p.priority_score ?? 0).toFixed(0) : '—'}
                    </span>
                  </td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={Boolean(mergeSources[p.id])}
                      disabled={p.id === mergeTargetId}
                      onChange={(e) =>
                        setMergeSources((prev) => ({ ...prev, [p.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="p-2 font-mono text-xs text-slate-500">{p.id.slice(0, 8)}…</td>
                  <td className="p-2">{displayProductName(p.name)}</td>
                  <td className="p-2 text-slate-600">{displayProductName(p.normalized_name)}</td>
                </tr>
              ))}
              {!displayedProducts.length && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={5}>
                    {t('products.loadProducts')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-800">{t('products.duplicatesTitle')}</h2>
        <p className="text-sm text-slate-600">{t('products.duplicatesLead')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDuplicates}
            disabled={dupLoading}
            className="px-3 py-2 text-sm rounded bg-slate-800 text-white disabled:opacity-50"
          >
            {t('products.loadDuplicates')}
          </button>
          <button
            type="button"
            onClick={runAutoMerge}
            disabled={dupLoading}
            className="px-3 py-2 text-sm rounded bg-violet-700 text-white disabled:opacity-50"
          >
            {t('products.autoMerge')}
          </button>
        </div>
        {dupError && <p className="text-sm text-red-600">{dupError}</p>}
        {dupMessage && <p className="text-sm text-emerald-700">{dupMessage}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-2">{t('products.duplicateCol1')}</th>
                <th className="text-left p-2">{t('products.duplicateCol2')}</th>
                <th className="text-right p-2">{t('products.similarity')}</th>
                <th className="text-left p-2">{t('products.action')}</th>
              </tr>
            </thead>
            <tbody>
              {duplicatePairs.map((row, i) => (
                <tr key={`${row.product1.id}-${row.product2.id}-${i}`} className="border-b border-slate-100">
                  <td className="p-2">{displayProductName(row.product1.name)}</td>
                  <td className="p-2">{displayProductName(row.product2.name)}</td>
                  <td className="p-2 text-right">{row.similarity.toFixed(3)}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      disabled={dupLoading}
                      onClick={() => mergeDuplicateRow(row.product1, row.product2)}
                      className="text-xs px-2 py-1 rounded bg-amber-600 text-white disabled:opacity-50"
                    >
                      {t('products.mergeRow')}
                    </button>
                  </td>
                </tr>
              ))}
              {!duplicatePairs.length && (
                <tr>
                  <td colSpan={4} className="p-4 text-slate-500">
                    {t('products.noDuplicates')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-800">{t('products.historyTitle')}</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={historyProductId}
            onChange={(e) => setHistoryProductId(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-sm min-w-[220px]"
          >
            <option value="">{t('products.historyPick')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {displayProductName(p.name)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading || !historyProductId}
            className="px-3 py-2 text-sm rounded bg-slate-800 text-white disabled:opacity-50"
          >
            {t('products.historyLoad')}
          </button>
        </div>
        {historyError && <p className="text-sm text-red-600">{historyError}</p>}
        <ul className="text-sm space-y-2 max-h-64 overflow-y-auto">
          {historyRows.map((h) => (
            <li key={h.id} className="border-b border-slate-100 pb-2">
              <span className="text-slate-500">{new Date(h.created_at).toLocaleString()}</span>{' '}
              <span className="font-medium">{h.action}</span>
              {h.meta ? (
                <pre className="text-xs mt-1 bg-slate-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(h.meta, null, 0)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-800">{t('products.normalizationTitle')}</h2>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 text-sm rounded bg-slate-800 text-white disabled:opacity-50"
          >
            {t('products.normalizationLoad')}
          </button>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t('products.normalizationTargetPlaceholder')}
            className="px-3 py-2 border border-slate-300 rounded text-sm flex-1"
          />
          <button
            type="button"
            onClick={apply}
            disabled={loading || !selectedNames.length || !target.trim()}
            className="px-3 py-2 text-sm rounded bg-emerald-700 text-white disabled:opacity-50"
          >
            {t('products.normalizationApply')}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-2">{t('products.colSelect')}</th>
                <th className="text-left p-2">
                  <button type="button" className={thBtn} onClick={() => onItemsSort('raw_name')}>
                    {t('products.colRawName')} {sortArrow(itemsSortKey === 'raw_name', itemsSortDir)}
                  </button>
                </th>
                <th className="text-left p-2">
                  <button type="button" className={thBtn} onClick={() => onItemsSort('normalized_name')}>
                    {t('products.colNormalizedName')} {sortArrow(itemsSortKey === 'normalized_name', itemsSortDir)}
                  </button>
                </th>
                <th className="text-right p-2">
                  <button type="button" className={thBtn} onClick={() => onItemsSort('usage_count')}>
                    {t('products.colUsage')} {sortArrow(itemsSortKey === 'usage_count', itemsSortDir)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[item.id])}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="p-2">{displayProductName(item.raw_name)}</td>
                  <td className="p-2">{displayProductName(item.normalized_name)}</td>
                  <td className="p-2 text-right">{item.usage_count}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={4}>
                    {t('products.normalizationEmpty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
