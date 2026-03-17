import { useState, useEffect } from 'react';
import { api, type TelegramUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n/LocaleContext';

export default function TelegramAdmin() {
  const { user } = useAuth();
  const t = useT();
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [status, setStatus] = useState<{ enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  if (user?.role !== 'admin') {
    return (
      <div className="p-4 text-slate-600">{t('telegram.accessDenied')}</div>
    );
  }

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, statusRes] = await Promise.all([
        api.telegram.users(),
        api.telegram.status(),
      ]);
      setUsers(usersRes.users);
      setStatus(statusRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user?.role]);

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('telegram.title')}</h1>
      {status && (
        <p className="text-sm text-slate-600">
          {t('telegram.botStatus')}: {status.enabled ? t('telegram.enabled') : t('telegram.disabled')}
        </p>
      )}
      <p className="text-sm text-slate-500">
        {t('telegram.usersDescription')}
      </p>
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
