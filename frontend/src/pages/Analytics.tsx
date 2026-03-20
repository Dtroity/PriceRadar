import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Product } from '../api/client';
import {
  fetchBestSuppliers,
  fetchPriceHistory,
  fetchPriceSummary,
  type BestSuppliersResponse,
  type PriceHistoryResponse,
  type PriceSummaryResponse,
} from '../api/analyticsClient';
import PriceHistoryChart from '../components/analytics/PriceHistoryChart';
import PriceSummaryCards from '../components/analytics/PriceSummaryCards';
import SupplierRankingTable from '../components/analytics/SupplierRankingTable';
type Tab = 'history' | 'suppliers' | 'summary';

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'history';
  const productFromUrl = searchParams.get('product_id') ?? '';

  const [periodDays, setPeriodDays] = useState<30 | 90 | 180>(90);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState(productFromUrl);
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);

  const [historyData, setHistoryData] = useState<PriceHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [suppliersData, setSuppliersData] = useState<BestSuppliersResponse | null>(null);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<PriceSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    setProductId(productFromUrl);
  }, [productFromUrl]);

  useEffect(() => {
    api.products().then((r) => setProducts(r.products)).catch(() => setProducts([]));
  }, []);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    setSearchParams(next, { replace: true });
  };

  const loadHistory = useCallback(async () => {
    if (!productId) {
      setHistoryData(null);
      return;
    }
    setHistoryLoading(true);
    try {
      const data = await fetchPriceHistory({
        productId,
        periodDays,
        supplierId: supplierFilter ?? undefined,
      });
      setHistoryData(data);
    } catch {
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [productId, periodDays, supplierFilter]);

  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, loadHistory]);

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const data = await fetchBestSuppliers({ periodDays });
      setSuppliersData(data);
    } catch {
      setSuppliersData(null);
    } finally {
      setSuppliersLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    if (tab === 'suppliers') void loadSuppliers();
  }, [tab, loadSuppliers]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await fetchPriceSummary(periodDays);
      setSummaryData(data);
    } catch {
      setSummaryData(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    if (tab === 'summary') void loadSummary();
  }, [tab, loadSummary]);

  const onProductFromSummary = (id: string) => {
    setProductId(id);
    setSupplierFilter(null);
    const next = new URLSearchParams();
    next.set('tab', 'history');
    next.set('product_id', id);
    setSearchParams(next, { replace: true });
  };

  const onSupplierRowClick = (sid: string) => {
    setSupplierFilter(sid);
    setTab('history');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">Аналитика цен</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Период:</span>
          {([30, 90, 180] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setPeriodDays(d)}
              className={`rounded-lg px-3 py-1 ${
                periodDays === d ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {d} дн.
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            ['history', 'Динамика цен'],
            ['suppliers', 'Поставщики'],
            ['summary', 'Сводка'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === id ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm text-slate-600">Товар</label>
            <select
              value={productId}
              onChange={(e) => {
                const v = e.target.value;
                setProductId(v);
                const next = new URLSearchParams(searchParams);
                if (v) next.set('product_id', v);
                else next.delete('product_id');
                next.set('tab', 'history');
                setSearchParams(next, { replace: true });
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm min-w-[240px]"
            >
              <option value="">— выберите —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {supplierFilter && (
              <button
                type="button"
                className="text-sm text-slate-600 underline"
                onClick={() => setSupplierFilter(null)}
              >
                Сбросить фильтр поставщика
              </button>
            )}
          </div>
          <PriceHistoryChart
            data={historyData}
            loading={historyLoading}
            emptyMessage={
              productId
                ? 'Нет данных за выбранный период'
                : 'Выберите товар, чтобы построить график'
            }
          />
        </div>
      )}

      {tab === 'suppliers' && (
        <SupplierRankingTable
          data={suppliersData}
          loading={suppliersLoading}
          onSupplierClick={onSupplierRowClick}
        />
      )}

      {tab === 'summary' && (
        <PriceSummaryCards
          data={summaryData}
          loading={summaryLoading}
          periodDays={periodDays}
          onProductClick={onProductFromSummary}
        />
      )}
    </div>
  );
}
