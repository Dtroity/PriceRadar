import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Product } from '../../api/client';
import type { Supplier } from '../../api/client';
import {
  deleteOrderItem,
  getOrder,
  patchOrder,
  patchOrderItem,
  patchOrderStatus,
  type ProcurementOrderDetail,
  type ProcurementOrderStatus,
} from '../../api/procurementClient';
import AddProductRow from '../../components/procurement/AddProductRow';
import OrderStatusBadge from '../../components/procurement/OrderStatusBadge';
import { useT } from '../../i18n/LocaleContext';
import OrderDispatches from './OrderDispatches';

const NEXT: Record<ProcurementOrderStatus, ProcurementOrderStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [order, setOrder] = useState<ProcurementOrderDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'items' | 'dispatches'>('items');

  const reload = useCallback(async () => {
    if (!id) return;
    setErr(null);
    setLoading(true);
    try {
      const [o, pr, sup] = await Promise.all([getOrder(id), api.products(), api.suppliers()]);
      setOrder(o);
      setTitle(o.title ?? '');
      setNotes(o.notes ?? '');
      setSupplierId(o.supplier_id ?? '');
      setProducts(pr.products);
      setSuppliers(sup.suppliers);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveHeader = async () => {
    if (!id || !order) return;
    try {
      await patchOrder(id, {
        title: title || null,
        notes: notes || null,
        supplier_id: supplierId || null,
      });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  const changeStatus = async (s: ProcurementOrderStatus) => {
    if (!id) return;
    try {
      await patchOrderStatus(id, s);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  const commitItemQuantity = async (itemId: string, quantity: string) => {
    if (!id) return;
    const q = Number.parseFloat(quantity.replace(',', '.'));
    if (!Number.isFinite(q)) return;
    try {
      await patchOrderItem(id, itemId, { quantity: q });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  const commitItemActual = async (itemId: string, actual_price: string) => {
    if (!id) return;
    const raw = actual_price.trim();
    const ap = raw === '' ? null : Number.parseFloat(raw.replace(',', '.'));
    if (raw !== '' && !Number.isFinite(ap!)) return;
    try {
      await patchOrderItem(id, itemId, { actual_price: ap });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  const removeItem = async (itemId: string) => {
    if (!id) return;
    try {
      await deleteOrderItem(id, itemId);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  if (!id) {
    return <p className="text-slate-600">{t('common.error')}</p>;
  }

  if (loading && !order) {
    return <p className="text-slate-500">{t('common.loading')}</p>;
  }

  if (!order) {
    return (
      <div className="space-y-2">
        <p className="text-red-600">{err}</p>
        <Link to="/procurement" className="text-sm text-slate-600 underline">
          {t('procurement.backToList')}
        </Link>
      </div>
    );
  }

  const nextStatuses = NEXT[order.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/procurement" className="text-sm text-slate-600 hover:text-slate-900">
          ← {t('procurement.backToList')}
        </Link>
        <OrderStatusBadge status={order.status} label={t(`procurement.status.${order.status}`)} />
      </div>

      {err && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{err}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">{t('procurement.orderDetail')}</h1>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">{t('procurement.orderTitleCol')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void saveHeader()}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t('dashboard.supplier')}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
              }}
              onBlur={() => void saveHeader()}
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600">{t('procurement.notes')}</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void saveHeader()}
          />
        </label>

        {nextStatuses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-600 self-center">{t('procurement.changeStatus')}:</span>
            {nextStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void changeStatus(s)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {t(`procurement.status.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${tab === 'items' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
              onClick={() => setTab('items')}
            >
              {t('procurement.lines')}
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${tab === 'dispatches' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
              onClick={() => setTab('dispatches')}
            >
              {t('procurement.dispatchesTab')}
            </button>
          </div>
          <p className="text-sm text-slate-600">
            {t('procurement.total')}: <strong>{order.total_sum.toFixed(2)}</strong>
          </p>
        </div>

        {tab === 'items' ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-3 py-2 text-left">{t('dashboard.product')}</th>
                  <th className="px-3 py-2 text-left">{t('procurement.quantity')}</th>
                  <th className="px-3 py-2 text-left">{t('procurement.targetPrice')}</th>
                  <th className="px-3 py-2 text-left">{t('procurement.actualPrice')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{it.product_name ?? it.product_id}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-24 rounded border border-slate-200 px-2 py-1"
                        defaultValue={it.quantity}
                        key={`${it.id}-q-${it.quantity}`}
                        onBlur={(e) => void commitItemQuantity(it.id, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-600">{it.target_price ?? '—'}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-24 rounded border border-slate-200 px-2 py-1"
                        placeholder="—"
                        defaultValue={it.actual_price ?? ''}
                        key={`${it.id}-a-${it.actual_price}`}
                        onBlur={(e) => void commitItemActual(it.id, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => void removeItem(it.id)}
                      >
                        {t('procurement.removeLine')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AddProductRow orderId={id} products={products} onAdded={() => void reload()} />
          </>
        ) : (
          <div className="p-4">
            <OrderDispatches orderId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
