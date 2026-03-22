import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api/client';

type Settings = {
  notify_email: string | null;
  notify_email_enabled: boolean;
  vk_notify_phone: string | null;
  vk_notify_enabled: boolean;
  webpush_enabled: boolean;
  notify_events: Record<string, boolean>;
  webpush_subscriptions: Array<{ id: string; endpoint: string; user_agent: string | null }>;
};

export default function NotificationsSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [vapid, setVapid] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    request<Settings>('/notifications/settings')
      .then(setS)
      .catch((e) => setErr(String(e.message)));
    request<{ publicKey: string | null }>('/notifications/vapid-public-key')
      .then((r) => setVapid(r.publicKey))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (patch: Partial<Settings>) => {
    setErr('');
    try {
      await request('/notifications/settings', { method: 'PATCH', body: JSON.stringify(patch) });
      setMsg('Сохранено');
      load();
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };

  const test = async () => {
    setErr('');
    try {
      await request('/notifications/test', { method: 'POST', body: JSON.stringify({}) });
      setMsg('Тест отправлен');
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };

  const enablePush = async () => {
    if (!vapid) {
      setErr('VAPID не настроен на сервере');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setErr('Браузер не поддерживает Push');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const keys = sub.getKey('p256dh');
      const auth = sub.getKey('auth');
      const enc = (b: ArrayBuffer | null) =>
        b ? btoa(String.fromCharCode(...new Uint8Array(b))) : '';
      await request('/notifications/webpush/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: enc(keys),
          auth: enc(auth),
        }),
      });
      setMsg('Подписка сохранена');
      load();
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };

  if (!s) return <div className="p-6 text-slate-500">Загрузка…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Уведомления</h1>
        <Link to="/settings" className="text-sm underline text-slate-600">
          Назад
        </Link>
      </div>
      {(msg || err) && (
        <div className={`text-sm p-2 rounded ${err ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
          {err || msg}
        </div>
      )}

      <section className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="font-medium">Email</h2>
        <input
          type="email"
          className="w-full border rounded px-3 py-2"
          placeholder="email@company.ru"
          defaultValue={s.notify_email ?? ''}
          id="ne"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.notify_email_enabled}
            onChange={(e) => save({ notify_email_enabled: e.target.checked })}
          />
          Включить email-уведомления
        </label>
        <button
          type="button"
          className="text-sm px-3 py-1 bg-slate-800 text-white rounded"
          onClick={() => {
            const el = document.getElementById('ne') as HTMLInputElement;
            save({ notify_email: el?.value || null, notify_email_enabled: true });
          }}
        >
          Сохранить email
        </button>
      </section>

      <section className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="font-medium">VK Notify</h2>
        <p className="text-xs text-slate-500">Номер должен быть привязан к аккаунту ВКонтакте. Нужен модуль notifications_vk.</p>
        <input
          type="tel"
          className="w-full border rounded px-3 py-2"
          placeholder="+79001234567"
          defaultValue={s.vk_notify_phone ?? ''}
          id="vkp"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.vk_notify_enabled}
            onChange={(e) => save({ vk_notify_enabled: e.target.checked })}
          />
          Включить VK Notify
        </label>
        <button
          type="button"
          className="text-sm px-3 py-1 border rounded"
          onClick={() => {
            const el = document.getElementById('vkp') as HTMLInputElement;
            save({ vk_notify_phone: el?.value || null });
          }}
        >
          Сохранить телефон
        </button>
      </section>

      <section className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
        <h2 className="font-medium">Web Push</h2>
        <button type="button" className="px-3 py-2 bg-slate-800 text-white rounded text-sm" onClick={enablePush}>
          Включить уведомления в браузере
        </button>
        <p className="text-xs text-slate-500">Устройств подписано: {s.webpush_subscriptions?.length ?? 0}</p>
        <ul className="text-xs space-y-1">
          {(s.webpush_subscriptions ?? []).map((sub) => (
            <li key={sub.id} className="flex justify-between gap-2 border-t pt-1">
              <span className="truncate">{sub.user_agent || sub.endpoint.slice(0, 40)}</span>
              <button
                type="button"
                className="text-red-600 shrink-0"
                onClick={() =>
                  request('/notifications/webpush/subscribe', {
                    method: 'DELETE',
                    body: JSON.stringify({ id: sub.id }),
                  }).then(load)
                }
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
        <h2 className="font-medium text-amber-900">Telegram (legacy)</h2>
        <p className="text-sm text-amber-900/90">
          Telegram может быть недоступен в РФ. Рекомендуем Email или VK Notify. Настройки — в разделе{' '}
          <Link to="/telegram" className="underline">
            Telegram
          </Link>
          .
        </p>
      </section>

      <section className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
        <h2 className="font-medium">События</h2>
        {Object.entries(s.notify_events ?? {}).map(([k, v]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!v}
              onChange={(e) =>
                save({
                  notify_events: { ...s.notify_events, [k]: e.target.checked },
                })
              }
            />
            {k}
          </label>
        ))}
      </section>

      <button type="button" className="px-4 py-2 border rounded" onClick={test}>
        Отправить тестовое уведомление
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
