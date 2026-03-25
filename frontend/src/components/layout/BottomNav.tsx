import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { cn } from '../../lib/cn';
import { IconBarChart, IconCart, IconFileText, IconHome, IconMenu } from './NavIcons';
import MoreMenuDrawer from './MoreMenuDrawer';
import { listRecommendations } from '../../api/procurementClient';
import { useAuth } from '../../auth/AuthContext';

export default function BottomNav() {
  const { t } = useLocale();
  const location = useLocation();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [recBadge, setRecBadge] = useState(0);

  useEffect(() => {
    if (user?.role === 'employee') return;
    let cancelled = false;
    listRecommendations()
      .then((r) => {
        if (!cancelled) setRecBadge(r.length);
      })
      .catch(() => {
        if (!cancelled) setRecBadge(0);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1 text-[11px] font-medium text-slate-600',
      isActive && 'text-amber-900'
    );

  if (user?.role === 'employee') {
    return (
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border)] bg-white/95 backdrop-blur-sm',
          'pb-[env(safe-area-inset-bottom)] md:hidden'
        )}
        aria-label="Employee"
      >
        <NavLink to="/employee" className={itemClass} end>
          <IconCart />
          <span>Заказ</span>
        </NavLink>
      </nav>
    );
  }

  return (
    <>
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border)] bg-white/95 backdrop-blur-sm',
          'pb-[env(safe-area-inset-bottom)] md:hidden'
        )}
        aria-label="Main"
      >
        <NavLink to="/" className={itemClass} end>
          <IconHome />
          <span>{t('nav.bottom.home')}</span>
        </NavLink>
        <NavLink to="/documents" className={itemClass}>
          <IconFileText />
          <span>{t('nav.bottom.documents')}</span>
        </NavLink>
        <NavLink to="/procurement" className={itemClass}>
          <span className="relative inline-flex">
            <IconCart />
            {recBadge > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-600 px-0.5 text-[9px] font-bold text-white">
                {recBadge > 9 ? '9+' : recBadge}
              </span>
            )}
          </span>
          <span>{t('nav.bottom.procurement')}</span>
        </NavLink>
        <NavLink to="/analytics" className={itemClass}>
          <IconBarChart />
          <span>{t('nav.bottom.analytics')}</span>
        </NavLink>
        <button
          type="button"
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1 text-[11px] font-medium text-slate-600',
            moreOpen && 'text-amber-900'
          )}
          onClick={() => setMoreOpen(true)}
        >
          <IconMenu />
          <span>{t('nav.more')}</span>
        </button>
      </nav>
      <MoreMenuDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
