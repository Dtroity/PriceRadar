import { Link } from 'react-router-dom';
import { useT } from '../i18n/LocaleContext';

export default function Settings() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('settings.title')}</h1>
      <p className="text-slate-600">{t('settings.description')}</p>
      <Link
        to="/settings/notifications"
        className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-800 hover:bg-slate-50"
      >
        Настройки уведомлений (Email, VK, Web Push)
      </Link>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        {t('settings.comingSoon')}
      </div>
    </div>
  );
}
