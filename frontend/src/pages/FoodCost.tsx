import { useT } from '../i18n/LocaleContext';

export default function FoodCost() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('foodcost.title')}</h1>
      <p className="text-slate-600">{t('foodcost.description')}</p>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        {t('foodcost.comingSoon')}
      </div>
    </div>
  );
}
