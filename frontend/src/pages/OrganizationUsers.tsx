import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { request } from '../api/client';

type OrgUserRow = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function OrganizationUsers() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<OrgUserRow[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'org_admin' | 'manager' | 'employee' | 'supplier'>('manager');

  const canManage = user?.role === 'org_admin' || user?.role === 'super_admin';

  const load = useCallback(async () => {
    setErr('');
    const r = await request<{ users: OrgUserRow[] }>('/org/users');
    setRows(r.users ?? []);
  }, []);

  useEffect(() => {
    if (!canManage || loading) return;
    void load().catch((e) => setErr(String(e.message)));
  }, [canManage, loading, load]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.email.localeCompare(b.email, 'ru')), [rows]);

  if (loading) return <div className="p-6 text-slate-500">Загрузка…</div>;
  if (!canManage) return <Navigate to="/settings" replace />;

  const createUser = async () => {
    setBusy(true);
    setErr('');
    try {
      await request('/org/users', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, role: newRole }),
      });
      setNewEmail('');
      setNewPassword('');
      setNewRole('manager');
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const patchUser = async (id: string, body: Partial<{ email: string | null; role: string | null; is_active: boolean | null }>) => {
    setBusy(true);
    setErr('');
    try {
      await request(`/org/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (id: string, email: string) => {
    const ok = window.confirm(`Удалить пользователя ${email}?\n\nЭто действие необратимо.`);
    if (!ok) return;
    setBusy(true);
    setErr('');
    try {
      await request(`/org/users/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Пользователи организации</h1>
          <p className="text-sm text-slate-600">Создание, блокировка и управление ролями</p>
        </div>
        <Link to="/settings" className="text-sm text-slate-600 underline">
          ← Настройки
        </Link>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Добавить пользователя</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Пароль (мин 6)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="manager">manager</option>
            <option value="employee">employee</option>
            <option value="supplier">supplier</option>
            <option value="org_admin">org_admin</option>
          </select>
        </div>
        <button
          type="button"
          disabled={busy || !newEmail.trim() || newPassword.trim().length < 6}
          onClick={() => void createUser()}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Создать'}
        </button>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b px-4 py-3 text-sm text-slate-600">Пользователей: {rows.length}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Роль</th>
                <th className="px-4 py-3">Активен</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((u) => (
                <tr key={u.id} className="h-12 md:h-14">
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => void patchUser(u.id, { role: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="manager">manager</option>
                      <option value="employee">employee</option>
                      <option value="supplier">supplier</option>
                      <option value="org_admin">org_admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(u.is_active)}
                      disabled={busy}
                      onChange={(e) => void patchUser(u.id, { is_active: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteUser(u.id, u.email)}
                      className="text-sm text-red-700 underline disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Нет пользователей
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

