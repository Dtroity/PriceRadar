import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { request } from '../api/client';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  users_count: number;
  documents_last_30d: number;
};

export default function Admin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<'orgs' | 'stats'>('orgs');
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user?.role !== 'super_admin' || loading) return;
    if (tab === 'stats') {
      request<{ orgs_by_plan: Record<string, number>; documents_last_30d: number; active_users: number; total_orgs: number }>(
        '/admin/stats'
      )
        .then(setStats)
        .catch((e) => setErr(String(e.message)));
      return;
    }
    const qs = new URLSearchParams({ limit: '50', page: '1' });
    if (q.trim()) qs.set('q', q.trim());
    request<{ organizations: OrgRow[]; total: number }>(`/admin/organizations?${qs}`)
      .then((r) => {
        setOrgs(r.organizations);
        setTotal(r.total);
      })
      .catch((e) => setErr(String(e.message)));
  }, [user, loading, tab, q]);

  if (loading) return <div className="p-6 text-slate-500">Загрузка…</div>;
  if (user?.role !== 'super_admin') return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Админ платформы</h1>
        <Link to="/" className="text-sm text-slate-600 underline">
          На главную
        </Link>
      </div>
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          className={`px-3 py-1 rounded ${tab === 'orgs' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
          onClick={() => setTab('orgs')}
        >
          Организации
        </button>
        <button
          type="button"
          className={`px-3 py-1 rounded ${tab === 'stats' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
          onClick={() => setTab('stats')}
        >
          Статистика
        </button>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}

      {tab === 'orgs' && (
        <>
          <input
            type="search"
            placeholder="Поиск по имени"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2"
          />
          <p className="text-sm text-slate-500">Всего: {total}</p>
          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-2">Название</th>
                  <th className="p-2">План</th>
                  <th className="p-2">Активна</th>
                  <th className="p-2">Пользователей</th>
                  <th className="p-2">Док. 30д</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{o.name}</td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-xs uppercase">{o.plan}</span>
                    </td>
                    <td className="p-2">{o.is_active ? 'да' : 'нет'}</td>
                    <td className="p-2">{o.users_count}</td>
                    <td className="p-2">{o.documents_last_30d}</td>
                    <td className="p-2">
                      <Link to={`/admin/org/${o.id}`} className="text-slate-800 underline">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'stats' && stats && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-slate-500 text-sm">Организаций</div>
            <div className="text-2xl font-semibold">{(stats as { total_orgs: number }).total_orgs}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-slate-500 text-sm">Документов за 30 дней</div>
            <div className="text-2xl font-semibold">{(stats as { documents_last_30d: number }).documents_last_30d}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-slate-500 text-sm">Пользователей</div>
            <div className="text-2xl font-semibold">{(stats as { active_users: number }).active_users}</div>
          </div>
          <div className="md:col-span-3 bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-slate-500 text-sm mb-2">По тарифам</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Тариф</th>
                    <th className="py-2 pr-3">Организаций</th>
                  </tr>
                </thead>
                <tbody>
                  {(['free', 'pro', 'enterprise'] as const).map((k) => (
                    <tr key={k} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium">{k}</td>
                      <td className="py-2 pr-3">
                        {((stats as { orgs_by_plan: Record<string, number> }).orgs_by_plan?.[k] ?? 0) as number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
