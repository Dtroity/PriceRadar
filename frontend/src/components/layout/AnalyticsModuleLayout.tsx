import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { cn } from '../../lib/cn';

const tabClass = (active: boolean) =>
  cn(
    'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors min-h-[44px] inline-flex items-center',
    active ? 'border-amber-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
  );

export default function AnalyticsModuleLayout() {
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
        aria-label="Аналитика"
      >
        <Link to="/analytics?tab=history" className={tabClass(onMain && !isAnomalies && !isPrices && !isForecast && tab === 'history')}>
          Динамика цен
        </Link>
        <Link to="/analytics?tab=suppliers" className={tabClass(onMain && !isAnomalies && !isPrices && !isForecast && tab === 'suppliers')}>
          Поставщики
        </Link>
        <Link to="/analytics?tab=summary" className={tabClass(onMain && !isAnomalies && !isPrices && !isForecast && tab === 'summary')}>
          Сводка
        </Link>
        <Link to="/analytics/prices" className={tabClass(isPrices)}>
          Цены
        </Link>
        <Link to="/analytics/forecast" className={tabClass(isForecast)}>
          Прогноз
        </Link>
        <Link to="/analytics/anomalies" className={tabClass(isAnomalies)}>
          Аномалии
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
