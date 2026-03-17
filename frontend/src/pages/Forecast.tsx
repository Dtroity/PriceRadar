import { useT } from '../i18n/LocaleContext';

export default function Forecast() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('forecast.title')}</h1>
      <p className="text-slate-600">{t('forecast.description')}</p>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        {t('forecast.comingSoon')}
      </div>
    </div>
  );
}
