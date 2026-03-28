import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { useAuth } from '../../auth/AuthContext';
import { useLocale } from '../../i18n/LocaleContext';

const tabClass = (active: boolean) =>
  cn(
    'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors min-h-[44px] inline-flex items-center',
    active ? 'border-amber-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
  );

export default function SettingsModuleLayout() {
  const { user } = useAuth();
  const { t } = useLocale();

  const tabs: { to: string; end?: boolean; label: string }[] = [
    { to: '/settings', end: true, label: 'Обзор' },
    { to: '/settings/notifications', label: 'Уведомления' },
    { to: '/settings/integrations', label: t('nav.integrations') },
  ];

  if (user?.role === 'super_admin' || user?.role === 'org_admin') {
    tabs.push({ to: '/settings/telegram', label: t('nav.telegram') });
  }
  if (user?.role === 'super_admin') {
    tabs.push({ to: '/settings/admin', label: 'Админ платформы' });
  }

  return (
    <div className="space-y-4">
      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px scrollbar-thin"
        aria-label="Настройки"
      >
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => tabClass(isActive)}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
