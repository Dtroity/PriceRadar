import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import LocaleSwitcher from './LocaleSwitcher';
import BottomNav from './layout/BottomNav';
import Sidebar from './layout/Sidebar';
import { IconMenu } from './layout/NavIcons';
import { Logo } from './layout/Logo';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [tabletMenuOpen, setTabletMenuOpen] = useState(false);

  useEffect(() => {
    setTabletMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        tabletOverlayOpen={tabletMenuOpen}
        onCloseTabletOverlay={() => setTabletMenuOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0 md:pl-16 lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-white/95 px-3 backdrop-blur-sm md:px-4">
          <button
            type="button"
            className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:flex lg:hidden"
            aria-label="Open menu"
            onClick={() => setTabletMenuOpen(true)}
          >
            <IconMenu />
          </button>

          <Link to="/" className="md:hidden">
            <Logo size="sm" />
          </Link>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LocaleSwitcher />
            <span className="hidden max-w-[140px] truncate text-xs text-slate-500 sm:inline md:max-w-[200px]">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="tap-target-row rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              {t('nav.logout')}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6 lg:py-6">
          {children}
        </main>

        <footer className="hidden border-t border-slate-100 py-3 text-center md:block">
          <p className="text-xs text-slate-400/80">{t('app.poweredBy')}</p>
        </footer>
      </div>

      <BottomNav />
    </div>
  );
}
