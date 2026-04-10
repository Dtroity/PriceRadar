import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { Supplier } from '../../api/client';
import {
  acceptRecommendation,
  createOrder,
  dismissRecommendation,
  generateRecommendations,
  listOrders,
  listRecommendations,
  type ProcurementOrder,
  type ProcurementRecommendation,
} from '../../api/procurementClient';
import RecommendationCard from '../../components/procurement/RecommendationCard';
import OrderStatusBadge from '../../components/procurement/OrderStatusBadge';
import { useT } from '../../i18n/LocaleContext';

const STATUS_OPTS = ['', 'draft', 'pending', 'approved', 'ordered', 'received', 'cancelled'] as const;

function statusLabel(t: (k: string) => string, s: string): string {
  if (!s) return t('procurement.allStatuses');
  return t(`procurement.status.${s}`);
}

export default function Procurement() {
  const t = useT();
  const bp = useBreakpoint();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProcurementOrder[]>([]);
  const [recs, setRecs] = useState<ProcurementRecommendation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [recBusy, setRecBusy] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [orderSort, setOrderSort] = useState<'title' | 'status' | 'created_at'>('created_at');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [o, r, s] = await Promise.all([
        listOrders({
          status: status || undefined,
          supplier_id: supplierId || undefined,
        }),
        listRecommendations(),
        api.suppliers(),
      ]);
      setOrders(o);
      setRecs(r);
      setSuppliers(s.suppliers);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setLoading(false);
    }
  }, [status, supplierId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedOrders = [...orders].sort((a, b) => {
    const mul = orderDir === 'asc' ? 1 : -1;
    if (orderSort === 'title') {
      const aa = String(a.title ?? '').toLowerCase();
      const bb = String(b.title ?? '').toLowerCase();
      return aa.localeCompare(bb, 'ru') * mul;
    }
    if (orderSort === 'status') {
      const aa = String(a.status ?? '');
      const bb = String(b.status ?? '');
      return aa.localeCompare(bb, 'ru') * mul;
    }
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return (ta - tb) * mul;
  });

  const onOrderSort = (key: typeof orderSort) => {
    if (orderSort !== key) {
      setOrderSort(key);
      setOrderDir(key === 'created_at' ? 'desc' : 'asc');
      return;
    }
    setOrderDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const newOrder = async () => {
    setErr(null);
    try {
      const o = await createOrder({ title: t('procurement.defaultOrderTitle') });
      navigate(`/procurement/orders/${o.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  const runGenerate = async () => {
    setGenLoading(true);
    setErr(null);
    try {
      await generateRecommendations();
      const r = await listRecommendations();
      setRecs(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setGenLoading(false);
    }
  };

  const onAccept = async (id: string) => {
    setRecBusy(id);
    try {
      const res = await acceptRecommendation(id);
      setRecs((prev) => prev.filter((x) => x.id !== id));
      navigate(`/procurement/orders/${res.order_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setRecBusy(null);
    }
  };

  const onDismiss = async (id: string) => {
    setRecBusy(id);
    try {
      await dismissRecommendation(id);
      setRecs((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setRecBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t('procurement.hubTitle')}</h1>
          <p className="text-sm text-slate-600">{t('procurement.hubSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void newOrder()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
          >
            {t('procurement.newOrder')}
          </button>
        </div>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {recs.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-800">{t('procurement.recommendationsBlock')}</h2>
            <button
              type="button"
              disabled={genLoading}
              onClick={() => void runGenerate()}
              className="text-sm text-slate-600 underline disabled:opacity-50"
            >
              {genLoading ? t('common.loading') : t('procurement.generateRecs')}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recs.map((r) => (
              <RecommendationCard
                key={r.id}
                rec={r}
                busy={recBusy === r.id}
                onAccept={() => void onAccept(r.id)}
                onDismiss={() => void onDismiss(r.id)}
              />
            ))}
          </div>
        </section>
      )}

      {recs.length === 0 && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3">
          <p className="text-sm text-slate-600">{t('procurement.noActiveRecs')}</p>
          <button
            type="button"
            disabled={genLoading}
            onClick={() => void runGenerate()}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200 disabled:opacity-50"
          >
            {genLoading ? t('common.loading') : t('procurement.generateRecs')}
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-slate-800">{t('procurement.ordersList')}</h2>
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTS.map((s) => (
              <option key={s || 'all'} value={s}>
                {statusLabel(t, s)}
              </option>
            ))}
          </select>
          <select
            className="min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">{t('dashboard.allSuppliers')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <p className="p-6 text-slate-500">{t('common.loading')}</p>
          ) : bp === 'mobile' ? (
            <div className="flex flex-col gap-3 p-3">
              {sortedOrders.map((o) => {
                const supName =
                  suppliers.find((s) => s.id === o.supplier_id)?.name ?? t('procurement.supplierUnset');
                return (
                  <Link
                    key={o.id}
                    to={`/procurement/orders/${o.id}`}
                    className="block rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm active:bg-[var(--surface-raised)]"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {o.title ?? `Заявка #${o.id.slice(-6)}`}
                      </span>
                      <OrderStatusBadge status={o.status} label={t(`procurement.status.${o.status}`)} />
                    </div>
                    <div className="flex justify-between text-sm text-[var(--text-secondary)]">
                      <span className="truncate">{supName}</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-3 py-2 text-left">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                        onClick={() => onOrderSort('title')}
                      >
                        {t('procurement.orderTitleCol')}
                        {orderSort === 'title' ? (orderDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                        onClick={() => onOrderSort('status')}
                      >
                        {t('documents.status')}
                        {orderSort === 'status' ? (orderDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                        onClick={() => onOrderSort('created_at')}
                      >
                        {t('procurement.created')}
                        {orderSort === 'created_at' ? (orderDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left" />
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((o) => (
                    <tr key={o.id} className="h-12 border-b border-slate-100 md:h-14">
                      <td className="px-3 py-2">
                        <Link className="font-medium text-slate-900 hover:underline" to={`/procurement/orders/${o.id}`}>
                          {o.title || o.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <OrderStatusBadge status={o.status} label={t(`procurement.status.${o.status}`)} />
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={`/procurement/orders/${o.id}`}
                          className="table-action-icon inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-slate-600 hover:text-slate-900"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && orders.length === 0 && (
            <div className="p-8 text-center text-slate-500">{t('procurement.noProcurementOrders')}</div>
          )}
        </div>
      </section>
    </div>
  );
}
