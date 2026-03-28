import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useLocale } from '../../i18n/LocaleContext';
import { cn } from '../../lib/cn';
import AnomalyBadge from '../analytics/AnomalyBadge';
import { IconBarChart, IconCart, IconFileText, IconHome } from './NavIcons';
import { Logo } from './Logo';

type Props = {
  tabletOverlayOpen: boolean;
  onCloseTabletOverlay: () => void;
};

function NavIcon({ to }: { to: string }) {
  if (to === '/') return <IconHome />;
  if (to === '/documents') return <IconFileText />;
  if (to === '/analytics') return <IconBarChart />;
  if (to === '/procurement') return <IconCart />;
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-600">
      {to.slice(1, 2).toUpperCase() || '•'}
    </span>
  );
}

export default function Sidebar({ tabletOverlayOpen, onCloseTabletOverlay }: Props) {
  const { logout } = useAuth();
  const { t } = useLocale();

  const core: { to: string; label: string; end?: boolean }[] = [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/documents', label: t('nav.scan') },
    { to: '/analytics', label: t('nav.analytics') },
    { to: '/procurement', label: t('nav.procurement') },
    { to: '/products', label: t('nav.products') },
    { to: '/prices', label: t('nav.prices') },
    { to: '/forecast', label: t('nav.forecast') },
    { to: '/foodcost', label: t('nav.foodcost') },
    { to: '/stock', label: t('nav.stock') },
    { to: '/settings', label: t('nav.settings') },
  ];

  const linkClass = (isActive: boolean, compact: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
      compact ? 'justify-center px-2 lg:justify-start lg:px-3' : 'px-3',
      'text-slate-700 hover:bg-amber-50/90 hover:text-slate-900',
      isActive && 'bg-amber-100/90 text-amber-950'
    );

  const NavBlock = ({ compact }: { compact: boolean }) => (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
      {core.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          title={compact ? item.label : undefined}
          onClick={() => onCloseTabletOverlay()}
          className={({ isActive }) => linkClass(isActive, compact)}
        >
          <NavIcon to={item.to} />
          <span className={cn('truncate', compact && 'hidden lg:inline')}>{item.label}</span>
        </NavLink>
      ))}
      <div
        className={cn(
          'mt-1 border-t border-[var(--border)] pt-2',
          compact && 'flex flex-col items-stretch lg:block'
        )}
      >
        <div className={cn(compact && 'hidden lg:block')}>
          <AnomalyBadge />
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* md–lg: узкая колонка 64px; lg+: 240px */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col fixed left-0 top-0 z-30 h-screen border-r border-[var(--border)] bg-white',
          'w-16 lg:w-60'
        )}
        aria-label="Sidebar"
      >
        <div className="flex h-14 items-center border-b border-[var(--border)] px-3 lg:px-4">
          <Logo collapsed size="md" className="lg:hidden" />
          <Logo size="md" className="hidden lg:flex" />
        </div>
        <NavBlock compact />
        <div className="mt-auto border-t border-[var(--border)] p-2">
          <button
            type="button"
            onClick={() => void logout()}
            title={t('nav.logout')}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-50 lg:justify-start lg:px-3"
          >
            <span className="hidden lg:inline">{t('nav.logout')}</span>
            <span className="lg:hidden text-xs">⎋</span>
          </button>
        </div>
      </aside>

      {/* Планшет: overlay-меню 240px */}
      {tabletOverlayOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            aria-label="Close menu"
            onClick={onCloseTabletOverlay}
          />
          <div className="fixed left-0 top-0 z-50 flex h-full w-60 flex-col bg-white shadow-xl lg:hidden border-r border-[var(--border)]">
            <div className="flex h-14 items-center border-b border-[var(--border)] px-4">
              <Logo size="md" />
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
              {core.map((item) => (
                <NavLink
                  key={`ov-${item.to}`}
                  to={item.to}
                  end={item.end}
                  onClick={() => onCloseTabletOverlay()}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px]',
                      'text-slate-700 hover:bg-amber-50/90',
                      isActive && 'bg-amber-100/90 text-amber-950'
                    )
                  }
                >
                  <NavIcon to={item.to} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
              <div className="mt-1 border-t border-[var(--border)] pt-2">
                <AnomalyBadge />
              </div>
            </nav>
            <div className="border-t border-[var(--border)] p-2">
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 min-h-[44px]"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
