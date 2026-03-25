import { useEffect, useMemo, useState } from 'react';
import { request } from '../../api/client';
import { cn } from '../../lib/cn';
import DispatchChatPanel from './DispatchChatPanel';

type Dispatch = {
  id: string;
  status: 'sent' | 'accepted' | 'rejected' | 'partial' | 'completed' | string;
  items_count: number;
  unread_messages_count: number;
  sent_at: string;
  responded_at: string | null;
  supplier: { id: string; name: string; email: string | null };
};

function statusBadge(status: string) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  if (status === 'sent') return <span className={cn(base, 'bg-slate-100 text-slate-700')}>Отправлен</span>;
  if (status === 'accepted') return <span className={cn(base, 'bg-emerald-50 text-emerald-700')}>Принят</span>;
  if (status === 'rejected') return <span className={cn(base, 'bg-rose-50 text-rose-700')}>Отклонён</span>;
  if (status === 'partial') return <span className={cn(base, 'bg-amber-50 text-amber-800')}>Частично</span>;
  if (status === 'completed') return <span className={cn(base, 'bg-blue-50 text-blue-700')}>Завершён</span>;
  return <span className={cn(base, 'bg-slate-100 text-slate-700')}>{status}</span>;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'только что';
  if (h < 24) return `${h} ч назад`;
  const days = Math.floor(h / 24);
  return `${days} д назад`;
}

export default function OrderDispatches({ orderId }: { orderId: string }) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await request<{ dispatches: Dispatch[] }>(`/procurement/orders/${orderId}/dispatches`);
      setDispatches(r.dispatches ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const canResend = (d: Dispatch) => {
    if (d.status !== 'sent') return false;
    const sentAt = new Date(d.sent_at).getTime();
    if (!Number.isFinite(sentAt)) return false;
    return Date.now() - sentAt > 24 * 3600 * 1000;
  };

  const resend = async (dispatchId: string) => {
    await request(`/procurement/dispatches/${dispatchId}/resend`, { method: 'POST', body: JSON.stringify({}) });
    await load();
  };

  const openChat = async (dispatchId: string) => {
    setChatId(dispatchId);
  };

  const activeDispatch = useMemo(() => dispatches.find((d) => d.id === chatId) ?? null, [dispatches, chatId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-800">Отправки</h2>
        <button
          type="button"
          className="text-sm text-slate-600 hover:text-slate-900"
          onClick={() => void load()}
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-500 text-sm">Загрузка…</div>
      ) : dispatches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 text-sm">
          Отправок пока нет. Они появятся после перевода заявки в статус <b>approved</b>.
        </div>
      ) : (
        <div className="grid gap-3">
          {dispatches.map((d) => (
            <div key={d.id} className="border rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{d.supplier.name}</p>
                  <p className="text-sm text-gray-500">
                    {d.items_count} позиций · {formatRelativeDate(d.sent_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.unread_messages_count > 0 && (
                    <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                      {d.unread_messages_count}
                    </span>
                  )}
                  {statusBadge(d.status)}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() => void openChat(d.id)}
                >
                  Переписка
                </button>
                {canResend(d) && (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => void resend(d.id)}
                  >
                    Отправить повторно
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DispatchChatPanel
        open={Boolean(chatId)}
        dispatch={activeDispatch}
        onClose={() => setChatId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}

