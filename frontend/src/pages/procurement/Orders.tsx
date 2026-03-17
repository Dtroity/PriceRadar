import { useState, useEffect } from 'react';
import { request } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';

interface Order {
  id: string;
  supplier_id: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function ProcurementOrders() {
  const t = useT();
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    request<{ orders: Order[] }>('/order-automation/orders')
      .then((r) => setOrders(r.orders))
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">{t('procurement.ordersTitle')}</h1>
      <p className="text-slate-600">{t('procurement.ordersDescription')}</p>
      {err && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{err}</div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-3 py-2 text-left">{t('procurement.id')}</th>
              <th className="px-3 py-2 text-left">{t('dashboard.supplier')}</th>
              <th className="px-3 py-2 text-left">{t('documents.status')}</th>
              <th className="px-3 py-2 text-left">{t('procurement.created')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                <td className="px-3 py-2">{o.supplier_id.slice(0, 8)}…</td>
                <td className="px-3 py-2">{o.status}</td>
                <td className="px-3 py-2">{new Date(o.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && !err && (
          <div className="p-8 text-center text-slate-500">{t('procurement.noOrders')}</div>
        )}
      </div>
    </div>
  );
}
