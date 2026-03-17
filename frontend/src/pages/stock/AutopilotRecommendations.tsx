import { useState, useEffect } from 'react';
import { request } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';

interface Settings {
  autopilot_mode: string;
  autopilot_days_threshold: number;
}

export default function AutopilotRecommendations() {
  const t = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    request<Settings>('/procurement-autopilot/settings')
      .then(setSettings)
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')));
  }, []);

  const updateMode = (mode: string) => {
    if (!settings) return;
    setSaving(true);
    request<Settings>('/procurement-autopilot/settings', {
      method: 'PUT',
      body: JSON.stringify({ ...settings, autopilot_mode: mode }),
    })
      .then(() => setSettings((s) => (s ? { ...s, autopilot_mode: mode } : null)))
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setSaving(false));
  };

  if (!settings) return <div className="text-slate-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">{t('stock.autopilot')}</h1>
      <p className="text-slate-600">{t('stock.autopilotDescription')}</p>
      {err && <div className="rounded-lg bg-amber-50 p-3 text-sm">{err}</div>}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-medium text-slate-700">{t('stock.autopilotMode')}</p>
        <div className="flex flex-wrap gap-2">
          {['disabled', 'recommend_only', 'auto_generate', 'auto_send'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateMode(mode)}
              disabled={saving}
              className={`rounded-lg px-3 py-2 text-sm ${settings.autopilot_mode === mode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">{t('stock.daysThreshold')}: {settings.autopilot_days_threshold}</p>
      </div>
    </div>
  );
}
