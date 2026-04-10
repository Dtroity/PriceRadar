import { Link } from 'react-router-dom';
import LocaleSwitcher from '../components/LocaleSwitcher';
import { useLocale } from '../i18n/LocaleContext';

export default function Pricing() {
  const { t } = useLocale();
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('pricing.title')}</h1>
        <p className="text-slate-600 mb-8">{t('pricing.lead')}</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-lg text-slate-800">{t('admin.plan.free')}</h2>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              <li>{t('pricing.free.users')}</li>
              <li>{t('pricing.free.docs')}</li>
              <li>{t('pricing.free.features')}</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-slate-800 p-5 shadow-md ring-2 ring-slate-800">
            <h2 className="font-semibold text-lg text-slate-800">{t('admin.plan.pro')}</h2>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              <li>{t('pricing.pro.users')}</li>
              <li>{t('pricing.pro.docs')}</li>
              <li>{t('pricing.pro.features1')}</li>
              <li>{t('pricing.pro.features2')}</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-lg text-slate-800">{t('admin.plan.enterprise')}</h2>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              <li>{t('pricing.enterprise.unlimited')}</li>
              <li>{t('pricing.enterprise.modules')}</li>
              <li>{t('pricing.enterprise.extra')}</li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center">
          <Link to="/register" className="text-slate-800 font-medium underline">
            {t('pricing.register')}
          </Link>
          {' · '}
          <Link to="/login" className="text-slate-600 underline">
            {t('pricing.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
