import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import LocaleSwitcher from './LocaleSwitcher';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-slate-800">
          {t('app.name')}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/" className="text-slate-600 hover:text-slate-900">{t('nav.dashboard')}</Link>
          <Link to="/documents" className="text-slate-600 hover:text-slate-900">{t('nav.scan')}</Link>
          <Link to="/prices" className="text-slate-600 hover:text-slate-900">{t('nav.prices')}</Link>
          <Link to="/forecast" className="text-slate-600 hover:text-slate-900">{t('nav.forecast')}</Link>
          <Link to="/foodcost" className="text-slate-600 hover:text-slate-900">{t('nav.foodcost')}</Link>
          <Link to="/suppliers" className="text-slate-600 hover:text-slate-900">{t('nav.suppliers')}</Link>
          <Link to="/procurement/orders" className="text-slate-600 hover:text-slate-900">{t('nav.orders')}</Link>
          <Link to="/integrations" className="text-slate-600 hover:text-slate-900">{t('nav.integrations')}</Link>
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <Link to="/telegram" className="text-slate-600 hover:text-slate-900">{t('nav.telegram')}</Link>
          )}
          <Link to="/settings" className="text-slate-600 hover:text-slate-900">{t('nav.settings')}</Link>
        </nav>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <span className="text-sm text-slate-500">{user?.email}</span>
          <span className="text-xs text-slate-400 uppercase">{user?.role}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            {t('nav.logout')}
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
      <footer className="py-3 px-4 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400/80">
          {t('app.poweredBy')}
        </p>
      </footer>
    </div>
  );
}
