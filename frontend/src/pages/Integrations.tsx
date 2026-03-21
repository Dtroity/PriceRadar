import { useCallback, useEffect, useState } from 'react';
import { api, type IikoSyncLog } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n/LocaleContext';

export default function Integrations() {
  const t = useT();
  const { user } = useAuth();
  const canIiko = user?.role === 'org_admin' || user?.role === 'super_admin';

  const [iikoUrl, setIikoUrl] = useState('');
  const [iikoKey, setIikoKey] = useState('');
  const [lastSync, setLastSync] = useState<IikoSyncLog | null>(null);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!canIiko) return;
    setLoading(true);
    setMsg(null);
    try {
      const s = await api.iiko.status();
      setLastSync(s.last_sync);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('common.failed'));
      setLastSync(null);
    } finally {
      setLoading(false);
    }
  }, [canIiko, t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const saveIiko = async () => {
    setMsg(null);
    try {
      await api.iiko.patchSettings({
        iiko_api_url: iikoUrl.trim() === '' ? null : iikoUrl.trim(),
        iiko_api_key: iikoKey.trim() === '' ? null : iikoKey.trim(),
      });
      setMsg('OK');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setMsg(null);
    try {
      const r = await api.iiko.sync();
      setSyncResult({ created: r.created, updated: r.updated });
      await loadStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('integrations.title')}</h1>
      <p className="text-slate-600">{t('integrations.description')}</p>
      {msg && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{msg}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="font-medium text-slate-800">{t('integrations.iikoTitle')}</h2>
        <p className="text-sm text-slate-500">{t('integrations.iikoDescription')}</p>
        {canIiko ? (
          <>
            <label className="block text-sm">
              <span className="text-slate-600">{t('integrations.iikoUrl')}</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                value={iikoUrl}
                onChange={(e) => setIikoUrl(e.target.value)}
                placeholder="https://…/api/1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">{t('integrations.iikoKey')}</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                value={iikoKey}
                onChange={(e) => setIikoKey(e.target.value)}
                type="password"
                autoComplete="off"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveIiko()}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
              >
                {t('integrations.iikoSave')}
              </button>
              <button
                type="button"
                disabled={syncing}
                onClick={() => void runSync()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-800 disabled:opacity-50"
              >
                {syncing ? t('integrations.iikoSyncing') : t('integrations.iikoSync')}
              </button>
            </div>
            <div className="text-sm text-slate-600">
              <p>
                {t('integrations.iikoLastSync')}:{' '}
                {loading
                  ? '…'
                  : lastSync?.synced_at
                    ? new Date(lastSync.synced_at).toLocaleString()
                    : t('integrations.iikoNoSync')}
              </p>
              {lastSync && (
                <p>
                  {t('integrations.iikoResult')}: {lastSync.items_created} / {lastSync.items_updated}
                </p>
              )}
              {syncResult && (
                <p className="text-emerald-700">
                  {t('integrations.iikoResult')}: {syncResult.created} / {syncResult.updated}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">{t('products.mergeForbidden')}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 opacity-60">
          <h2 className="font-medium text-slate-800">R-keeper</h2>
          <p className="text-sm text-slate-500 mt-1">{t('integrations.comingSoon')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 opacity-60">
          <h2 className="font-medium text-slate-800">Poster</h2>
          <p className="text-sm text-slate-500 mt-1">{t('integrations.comingSoon')}</p>
        </div>
      </div>
    </div>
  );
}
