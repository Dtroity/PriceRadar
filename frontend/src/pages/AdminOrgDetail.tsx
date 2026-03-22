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
    users: Array<{ id: string; email: string; role: string }>;
    modules: Array<{ module: string; enabled: boolean }>;
  } | null>(null);
  const [plan, setPlan] = useState('free');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

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
        <ul className="text-sm space-y-1">
          {data.users.map((u) => (
            <li key={u.id}>
              {u.email} <span className="text-slate-400">({u.role})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
