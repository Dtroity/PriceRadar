import { useT } from '../i18n/LocaleContext';

export default function Integrations() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('integrations.title')}</h1>
      <p className="text-slate-600">{t('integrations.description')}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">iiko</h2>
          <p className="text-sm text-slate-500 mt-1">{t('integrations.notConnected')}</p>
          <button type="button" className="mt-3 px-3 py-1.5 bg-slate-800 text-white rounded text-sm">
            {t('integrations.connect')}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">R-keeper</h2>
          <p className="text-sm text-slate-500 mt-1">{t('integrations.comingSoon')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">Poster</h2>
          <p className="text-sm text-slate-500 mt-1">{t('integrations.comingSoon')}</p>
        </div>
      </div>
    </div>
  );
}
