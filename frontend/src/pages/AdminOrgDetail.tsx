import { useEffect, useState } from 'react';
import { Navigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { request } from '../api/client';

const MODULE_KEYS = [
  'analytics',
  'anomaly_detection',
  'procurement',
  'recommendations',
  'notifications_email',
  'notifications_vk',
  'notifications_push',
  'ai_features',
  'invoice_ai',
  'price_monitoring',
  'iiko_integration',
  'telegram_bot',
  'procurement_autopilot',
  'stock',
];

export default function AdminOrgDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [data, setData] = useState<{
    org: Record<string, unknown>;
    users: Array<{ id: string; email: string; role: string; is_active?: boolean | null }>;
    modules: Array<{ module: string; enabled: boolean }>;
  } | null>(null);
  const [plan, setPlan] = useState('free');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'org_admin' | 'manager' | 'employee' | 'supplier'>('manager');

  const load = () => {
    if (!id) return;
    request<NonNullable<typeof data>>(`/admin/organizations/${id}`)
      .then((d) => {
        setData(d);
        setPlan(String(d.org.plan ?? 'free'));
      })
      .catch((e) => setErr(String(e.message)));
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <div className="p-6">…</div>;
  if (user?.role !== 'super_admin') return <Navigate to="/" replace />;
  if (!id) return <Navigate to="/admin" replace />;

  const toggleModule = async (module: string, enabled: boolean) => {
    setSaving(true);
    try {
      await request(`/admin/organizations/${id}/modules`, {
        method: 'PATCH',
        body: JSON.stringify({ module, enabled }),
      });
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      await request(`/admin/organizations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ plan }),
      });
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="p-6 text-slate-500">Загрузка…</div>;

  const modMap = new Map(data.modules.map((m) => [m.module, m.enabled]));

  const patchUser = async (userId: string, body: Partial<{ email: string | null; role: string | null; is_active: boolean | null }>) => {
    setSaving(true);
    try {
      await request(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    const ok = window.confirm(`Удалить пользователя ${email}?\n\nЭто действие необратимо.`);
    if (!ok) return;
    setSaving(true);
    try {
      await request(`/admin/users/${userId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    if (!id) return;
    setCreatingUser(true);
    setErr('');
    try {
      await request(`/admin/organizations/${id}/users`, {
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
      setCreatingUser(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/admin" className="text-sm text-slate-600 underline">
        ← Организации
      </Link>
      <h1 className="text-2xl font-semibold">{String(data.org.name)}</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <h2 className="font-medium">Тариф</h2>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="enterprise">enterprise</option>
        </select>
        <button
          type="button"
          disabled={saving}
          onClick={savePlan}
          className="ml-2 px-3 py-1 bg-slate-800 text-white rounded text-sm"
        >
          Сохранить план
        </button>
        <p className="text-xs text-slate-500">Смена плана пересобирает модули по умолчанию для тарифа.</p>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="font-medium mb-3">Модули</h2>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {MODULE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={modMap.get(key) ?? false}
                disabled={saving}
                onChange={(e) => toggleModule(key, e.target.checked)}
              />
              <span>{key}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="font-medium mb-2">Пользователи</h2>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Пароль (мин 6)"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="manager">manager</option>
              <option value="employee">employee</option>
              <option value="supplier">supplier</option>
              <option value="org_admin">org_admin</option>
            </select>
          </div>
          <button
            type="button"
            disabled={creatingUser || saving || !newEmail.trim() || newPassword.trim().length < 6}
            onClick={createUser}
            className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {creatingUser ? 'Создание…' : 'Добавить пользователя'}
          </button>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Роль</th>
                  <th className="py-2 pr-3">Активен</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{u.email}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={u.role}
                        disabled={saving}
                        onChange={(e) => void patchUser(u.id, { role: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="manager">manager</option>
                        <option value="employee">employee</option>
                        <option value="supplier">supplier</option>
                        <option value="org_admin">org_admin</option>
                        <option value="super_admin">super_admin</option>
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={Boolean((u as any).is_active ?? true)}
                        disabled={saving}
                        onChange={(e) => void patchUser(u.id, { is_active: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void deleteUser(u.id, u.email)}
                        className="text-sm text-red-700 underline disabled:opacity-50"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
