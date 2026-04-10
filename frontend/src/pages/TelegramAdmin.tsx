import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type TelegramNotifySettings, type TelegramUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n/LocaleContext';

export default function TelegramAdmin() {
  const { user } = useAuth();
  const t = useT();
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [status, setStatus] = useState<{ enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState('');
  const [notify, setNotify] = useState<TelegramNotifySettings>({});
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [notifySaving, setNotifySaving] = useState(false);

  const canManageTelegram = user?.role === 'super_admin' || user?.role === 'org_admin';
  if (!canManageTelegram) {
    return (
      <div className="p-4 text-slate-600">{t('telegram.accessDenied')}</div>
    );
  }

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, statusRes, orgRes] = await Promise.all([
        api.telegram.users(),
        api.telegram.status(),
        api.telegram.orgSettings().catch(() => null),
      ]);
      setUsers(usersRes.users);
      setStatus(statusRes);
      if (orgRes) {
        setChatId(orgRes.telegram_chat_id ?? '');
        setNotify(orgRes.telegram_notify ?? {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageTelegram) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageTelegram]);

  const toggleAllow = async (tu: TelegramUser) => {
    try {
      await api.telegram.allow(tu.telegram_id, !tu.is_allowed);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === tu.id ? { ...u, is_allowed: !u.is_allowed } : u
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('telegram.removeConfirm'))) return;
    try {
      await api.telegram.remove(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleNotifyFlag = (key: keyof TelegramNotifySettings) => {
    setNotify((n) => ({ ...n, [key]: !n[key] }));
  };

  const saveNotify = async () => {
    setNotifySaving(true);
    setNotifyMsg(null);
    try {
      await api.telegram.patchOrgSettings({
        telegram_chat_id: chatId.trim() === '' ? null : chatId.trim(),
        telegram_notify: notify,
      });
      setNotifyMsg(t('common.saved'));
    } catch (e) {
      setNotifyMsg(e instanceof Error ? e.message : t('common.errorGeneric'));
    } finally {
      setNotifySaving(false);
    }
  };

  const sendTest = async () => {
    setNotifyMsg(null);
    try {
      await api.telegram.testMessage();
      setNotifyMsg(t('analytics.done'));
    } catch (e) {
      setNotifyMsg(e instanceof Error ? e.message : t('common.errorGeneric'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <strong>Telegram в РФ может быть заблокирован.</strong> Рекомендуем перейти на{' '}
        <Link to="/settings/notifications" className="underline font-medium">
          Email, VK Notify или Web Push
        </Link>
        .
      </div>
      <h1 className="text-xl font-semibold text-slate-800">{t('telegram.title')}</h1>
      {status && (
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            {t('telegram.botStatus')}: {status.enabled ? t('telegram.enabled') : t('telegram.disabled')}
          </p>
          {!status.enabled && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
              Бот на сервере выключен или нет токена. В <code className="rounded bg-slate-200 px-1">.env</code> укажите{' '}
              <code className="rounded bg-slate-200 px-1">TELEGRAM_BOT_TOKEN</code> (или{' '}
              <code className="rounded bg-slate-200 px-1">TELEGRAM_TOKEN</code>
              ), пересоберите backend. Чтобы явно отключить бота при наличии токена:{' '}
              <code className="rounded bg-slate-200 px-1">TELEGRAM_BOT_ENABLED=false</code>.
            </p>
          )}
        </div>
      )}
      <p className="text-sm text-slate-500">
        {t('telegram.usersDescription')}
      </p>
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-lg font-medium text-slate-800">{t('telegram.notifyTitle')}</h2>
        <p className="text-sm text-slate-500">{t('telegram.chatIdHint')}</p>
        <label className="block text-sm">
          <span className="text-slate-600">{t('telegram.chatId')}</span>
          <input
            className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-100…"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm">
          {(
            [
              ['anomaly_high', 'telegram.notify.anomaly_high'],
              ['anomaly_medium', 'telegram.notify.anomaly_medium'],
              ['recommendation', 'telegram.notify.recommendation'],
              ['order_status', 'telegram.notify.order_status'],
            ] as const
          ).map(([key, labelKey]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(notify[key])}
                onChange={() => toggleNotifyFlag(key)}
              />
              <span>{t(labelKey)}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={notifySaving}
            onClick={() => void saveNotify()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {t('telegram.saveNotify')}
          </button>
          <button
            type="button"
            onClick={() => void sendTest()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-800"
          >
            {t('telegram.sendTest')}
          </button>
        </div>
        {notifyMsg && <p className="text-sm text-slate-600">{notifyMsg}</p>}
      </section>

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium">{t('telegram.telegramId')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('telegram.username')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('telegram.allowed')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('telegram.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    {t('telegram.noUsers')}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">{u.telegram_id}</td>
                    <td className="py-3 px-4">@{u.username || '—'}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleAllow(u)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          u.is_allowed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.is_allowed ? t('telegram.yes') : t('telegram.no')}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => remove(u.id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        {t('telegram.remove')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
