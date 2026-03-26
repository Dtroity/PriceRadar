import { Link } from 'react-router-dom';
import { useT } from '../i18n/LocaleContext';

export default function Settings() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('settings.title')}</h1>
      <p className="text-slate-600">{t('settings.description')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          to="/settings/notifications"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-800 hover:bg-slate-50"
        >
          Настройки уведомлений (Email, VK, Web Push)
        </Link>
        <Link
          to="/integrations"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-800 hover:bg-slate-50"
        >
          Интеграции (iiko, Telegram)
        </Link>
        <Link
          to="/telegram"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-800 hover:bg-slate-50"
        >
          Telegram: пользователи и настройки
        </Link>
      </div>
    </div>
  );
}
