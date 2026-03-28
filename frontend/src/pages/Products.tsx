import { useMemo, useState } from 'react';
import { api, type Product, type ProductAuditEntry, type ProductNormalizationItem } from '../api/client';
import { useT } from '../i18n/LocaleContext';
import { displayProductName } from '../lib/displayProductName';

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

  const selectedNames = useMemo(
    () => items.filter((i) => selected[i.id]).map((i) => i.raw_name),
    [items, selected]
  );

  const mergeSourceIds = useMemo(
    () => products.filter((p) => mergeSources[p.id]).map((p) => p.id),
    [products, mergeSources]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.productNormalization.list();
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load normalization items');
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
      setMergeError(e instanceof Error ? e.message : 'Failed to load products');
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
      setError(e instanceof Error ? e.message : 'Failed to normalize products');
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
      const msg = e instanceof Error ? e.message : 'Merge failed';
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
      setDupError(e instanceof Error ? e.message : 'Duplicates load failed');
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
      setDupMessage(`Авто-merge: объединено пар — ${res.merged}`);
      await loadDuplicates();
      await loadProducts();
    } catch (e) {
      setDupError(e instanceof Error ? e.message : 'Auto-merge failed');
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
        `Объединено: ${displayProductName(newer.name)} → ${displayProductName(older.name)}`
      );
      await loadDuplicates();
      await loadProducts();
    } catch (e) {
      setDupError(e instanceof Error ? e.message : 'Merge failed');
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
      setHistoryError(e instanceof Error ? e.message : 'History load failed');
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
                <th className="text-left p-2">{t('products.mergeSources')}</th>
                <th className="text-left p-2">ID</th>
                <th className="text-left p-2">{t('stock.product')}</th>
                <th className="text-left p-2">normalized</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
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
              {!products.length && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={4}>
                    {t('products.loadProducts')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-800">Дубли (похожие товары)</h2>
        <p className="text-sm text-slate-600">
          Пары с высокой схожестью названий. Ручной merge — в старший по дате создания товар.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDuplicates}
            disabled={dupLoading}
            className="px-3 py-2 text-sm rounded bg-slate-800 text-white disabled:opacity-50"
          >
            Загрузить дубли
          </button>
          <button
            type="button"
            onClick={runAutoMerge}
            disabled={dupLoading}
            className="px-3 py-2 text-sm rounded bg-violet-700 text-white disabled:opacity-50"
          >
            Авто-merge (≥0.95)
          </button>
        </div>
        {dupError && <p className="text-sm text-red-600">{dupError}</p>}
        {dupMessage && <p className="text-sm text-emerald-700">{dupMessage}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-2">Товар 1</th>
                <th className="text-left p-2">Товар 2</th>
                <th className="text-right p-2">Схожесть</th>
                <th className="text-left p-2">Действие</th>
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
                      Merge
                    </button>
                  </td>
                </tr>
              ))}
              {!duplicatePairs.length && (
                <tr>
                  <td colSpan={4} className="p-4 text-slate-500">
                    Нет данных. Нажмите «Загрузить дубли» (нужна роль org_admin).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-800">История товара (audit)</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={historyProductId}
            onChange={(e) => setHistoryProductId(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-sm min-w-[220px]"
          >
            <option value="">— выберите товар —</option>
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
            Загрузить историю
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
        <h2 className="text-lg font-medium text-slate-800">Нормализация названий (алиасы)</h2>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 text-sm rounded bg-slate-800 text-white disabled:opacity-50"
          >
            Загрузить непонятные товары
          </button>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Целевое нормализованное название"
            className="px-3 py-2 border border-slate-300 rounded text-sm flex-1"
          />
          <button
            type="button"
            onClick={apply}
            disabled={loading || !selectedNames.length || !target.trim()}
            className="px-3 py-2 text-sm rounded bg-emerald-700 text-white disabled:opacity-50"
          >
            Объединить
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-2">Выбор</th>
                <th className="text-left p-2">raw_name</th>
                <th className="text-left p-2">normalized_name</th>
                <th className="text-right p-2">Использований</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
                    Список пуст. Нажмите &quot;Загрузить непонятные товары&quot;.
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
