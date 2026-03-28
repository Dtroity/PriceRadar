import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Product } from '../api/client';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useLocale } from '../i18n/LocaleContext';
import {
  fetchBestSuppliers,
  fetchPriceHistory,
  fetchPriceSummary,
  type BestSuppliersResponse,
  type PriceHistoryResponse,
  type PriceSummaryResponse,
} from '../api/analyticsClient';
import { displayProductName } from '../lib/displayProductName';
import PriceHistoryChart from '../components/analytics/PriceHistoryChart';
import PriceSummaryCards from '../components/analytics/PriceSummaryCards';
import SupplierRankingTable from '../components/analytics/SupplierRankingTable';
type Tab = 'history' | 'suppliers' | 'summary';

export default function Analytics() {
  const { t } = useLocale();
  const bp = useBreakpoint();
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
  const [productPickerOpen, setProductPickerOpen] = useState(false);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Аналитика цен</h1>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 text-sm scrollbar-thin sm:flex-wrap sm:overflow-visible">
          <span className="hidden shrink-0 self-center text-slate-500 sm:inline">Период:</span>
          {([30, 90, 180] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setPeriodDays(d)}
              className={`shrink-0 rounded-full px-4 py-2 sm:rounded-lg ${
                periodDays === d ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {d} дн.
            </button>
          ))}
        </div>
      </div>

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            {bp === 'mobile' ? (
              <>
                <button
                  type="button"
                  onClick={() => setProductPickerOpen(true)}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 shadow-sm"
                >
                  {productId
                    ? displayProductName(products.find((p) => p.id === productId)?.name) || 'Товар'
                    : '— выберите товар —'}
                </button>
                {productPickerOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-[100] bg-black/50"
                      aria-label="Close"
                      onClick={() => setProductPickerOpen(false)}
                    />
                    <div className="fixed inset-x-0 bottom-0 z-[110] max-h-[70vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)]">
                      <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {t('analytics.productPickerTitle')}
                      </div>
                      <div className="overflow-y-auto p-2">
                        <button
                          type="button"
                          className="w-full rounded-lg px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            setProductId('');
                            const next = new URLSearchParams(searchParams);
                            next.delete('product_id');
                            next.set('tab', 'history');
                            setSearchParams(next, { replace: true });
                            setProductPickerOpen(false);
                          }}
                        >
                          — сброс —
                        </button>
                        {products.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full rounded-lg px-4 py-3 text-left text-sm text-slate-900 hover:bg-amber-50"
                            onClick={() => {
                              setProductId(p.id);
                              const next = new URLSearchParams(searchParams);
                              next.set('product_id', p.id);
                              next.set('tab', 'history');
                              setSearchParams(next, { replace: true });
                              setProductPickerOpen(false);
                            }}
                          >
                            {displayProductName(p.name)}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="m-3 min-h-[48px] rounded-xl bg-slate-800 py-3 text-sm font-medium text-white"
                        onClick={() => setProductPickerOpen(false)}
                      >
                        {t('analytics.done')}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
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
                  className="min-h-[44px] min-w-[240px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— выберите —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayProductName(p.name)}
                    </option>
                  ))}
                </select>
              </>
            )}
            {supplierFilter && (
              <button
                type="button"
                className="tap-target-row text-sm text-slate-600 underline"
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
