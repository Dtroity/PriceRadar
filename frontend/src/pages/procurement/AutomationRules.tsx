import { useState, useEffect } from 'react';
import { request } from '../../api/client';
import { useT } from '../../i18n/LocaleContext';

export default function AutomationRules() {
  const t = useT();
  const [rules, setRules] = useState<{ id: string; rule_type: string; enabled: boolean }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    request<{ rules: typeof rules }>('/order-automation/automation-rules')
      .then((r) => setRules(r.rules))
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.failed')));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Procurement · {t('procurement.rules')}</h1>
      <p className="text-slate-600">{t('procurement.rulesDescription')}</p>
      {err && <div className="rounded-lg bg-amber-50 p-3 text-sm">{err}</div>}
      <ul className="space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
            {r.rule_type} {r.enabled ? '' : `(${t('procurement.disabled')})`}
          </li>
        ))}
      </ul>
      {rules.length === 0 && !err && <p className="text-slate-500">{t('procurement.noRulesYet')}</p>}
    </div>
  );
}
