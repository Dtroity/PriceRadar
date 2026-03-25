import { useEffect, useMemo, useState } from 'react';
import { request } from '../../api/client';

type Cell = {
  event_type: string;
  channel: string;
  enabled: boolean;
  include_details?: { items?: boolean; total?: boolean; link?: boolean } | null;
};

const EVENT_LABELS: Record<string, string> = {
  order_dispatched: 'Заказ отправлен поставщику',
  order_accepted: 'Поставщик принял заказ',
  order_rejected: 'Поставщик отклонил заказ',
  new_message: 'Новое сообщение от поставщика',
  anomaly_high: 'Аномалия цены (высокая)',
  anomaly_medium: 'Аномалия цены (средняя)',
  weekly_report: 'Еженедельный отчёт',
};

const CHANNEL_LABELS: Record<string, string> = {
  webpush: 'Web Push',
  email: 'Email',
  vk: 'VK',
  telegram: 'Telegram',
  in_app: 'В системе',
};

const CHANNELS = ['webpush', 'email', 'vk', 'telegram', 'in_app'] as const;

function key(e: string, c: string) {
  return `${e}::${c}`;
}

export default function NotificationMatrix() {
  const [cells, setCells] = useState<Cell[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setErr('');
    const r = await request<{ settings: Cell[] }>('/notifications/settings/matrix');
    setCells(r.settings ?? []);
  };

  useEffect(() => {
    void load().catch((e) => setErr(String((e as Error).message)));
  }, []);

  const map = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of cells) m.set(key(c.event_type, c.channel), c);
    return m;
  }, [cells]);

  const events = useMemo(() => Object.keys(EVENT_LABELS), []);

  const updateCell = (event_type: string, channel: string, patch: Partial<Cell>) => {
    setCells((prev) =>
      prev.map((c) =>
        c.event_type === event_type && c.channel === channel ? { ...c, ...patch } : c
      )
    );
  };

  const updateDetail = (event_type: string, channel: string, field: 'items' | 'total' | 'link', v: boolean) => {
    const c = map.get(key(event_type, channel));
    const cur = (c?.include_details as any) ?? { items: false, total: false, link: true };
    updateCell(event_type, channel, { include_details: { ...cur, [field]: v } });
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      await request('/notifications/settings/matrix', { method: 'PUT', body: JSON.stringify(cells) });
      setMsg('Сохранено');
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Матрица уведомлений</h2>
        <button
          type="button"
          disabled={saving}
          className="text-sm rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-50"
          onClick={() => void save()}
        >
          Сохранить
        </button>
      </div>
      {(msg || err) && (
        <div className={`text-sm p-2 rounded ${err ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
          {err || msg}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left font-medium px-3 py-2">Событие</th>
              {CHANNELS.map((c) => (
                <th key={c} className="text-left font-medium px-3 py-2">
                  {CHANNEL_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((e) => (
              <tr key={e}>
                <td className="px-3 py-3 text-slate-800">{EVENT_LABELS[e]}</td>
                {CHANNELS.map((ch) => {
                  const cell = map.get(key(e, ch));
                  const enabled = Boolean(cell?.enabled);
                  return (
                    <td key={ch} className="px-3 py-3 align-top">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(ev) => updateCell(e, ch, { enabled: ev.target.checked })}
                        />
                        <span className="text-slate-600">{enabled ? 'Вкл' : 'Выкл'}</span>
                      </label>
                      {ch === 'email' && e === 'order_dispatched' && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={Boolean((cell?.include_details as any)?.items ?? false)}
                            onChange={(ev) => updateDetail(e, ch, 'items', ev.target.checked)}
                          />
                          Список позиций
                        </label>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Если строк нет в БД — используются дефолты. После сохранения настройки начнут применяться при отправке.
      </p>
    </section>
  );
}

