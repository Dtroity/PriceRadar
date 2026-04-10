import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { useT } from '../../i18n/LocaleContext';

const tabClass = (active: boolean) =>
  cn(
    'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors min-h-[44px] inline-flex items-center',
    active ? 'border-amber-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
  );

export default function AnalyticsModuleLayout() {
  const t = useT();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as string) || 'history';

  const isAnomalies = pathname.startsWith('/analytics/anomalies');
  const isPrices = pathname.startsWith('/analytics/prices');
  const isForecast = pathname.startsWith('/analytics/forecast');
  const onMain = pathname === '/analytics';

  return (
    <div className="space-y-4 max-w-6xl mx-auto w-full">
      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px scrollbar-thin"
        aria-label={t('analyticsModule.navAria')}
      >
        <Link to="/analytics?tab=history" className={tabClass(onMain && !isAnomalies && !isPrices && !isForecast && tab === 'history')}>
          {t('analyticsModule.tabHistory')}
        </Link>
        <Link to="/analytics?tab=suppliers" className={tabClass(onMain && !isAnomalies && !isPrices && !isForecast && tab === 'suppliers')}>
          {t('analyticsModule.tabSuppliers')}
        </Link>
        <Link to="/analytics?tab=summary" className={tabClass(onMain && !isAnomalies && !isPrices && !isForecast && tab === 'summary')}>
          {t('analyticsModule.tabSummary')}
        </Link>
        <Link to="/analytics/prices" className={tabClass(isPrices)}>
          {t('analyticsModule.tabPrices')}
        </Link>
        <Link to="/analytics/forecast" className={tabClass(isForecast)}>
          {t('analyticsModule.tabForecast')}
        </Link>
        <Link to="/analytics/anomalies" className={tabClass(isAnomalies)}>
          {t('analyticsModule.tabAnomalies')}
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
