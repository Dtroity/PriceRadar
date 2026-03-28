import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { useT } from '../../i18n/LocaleContext';

const tabClass = (active: boolean) =>
  cn(
    'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors min-h-[44px] inline-flex items-center',
    active ? 'border-amber-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
  );

export default function StockModuleLayout() {
  const t = useT();

  const tabs: { to: string; end?: boolean; label: string }[] = [
    { to: '/stock', end: true, label: t('stock.overview') },
    { to: '/stock/forecast', label: t('stock.forecast') },
    { to: '/stock/autopilot', label: t('stock.autopilot') },
  ];

  return (
    <div className="space-y-4">
      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px scrollbar-thin"
        aria-label="Склад"
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
