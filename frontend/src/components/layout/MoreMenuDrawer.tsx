import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useLocale } from '../../i18n/LocaleContext';
import { cn } from '../../lib/cn';

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Нижний drawer «Ещё» — второстепенные разделы (мобильный + планшет). */
export default function MoreMenuDrawer({ open, onClose }: Props) {
  const { user } = useAuth();
  const { t } = useLocale();

  if (!open) return null;

  const links: { to: string; label: string }[] = [
    { to: '/products', label: t('nav.products') },
    { to: '/analytics/anomalies', label: 'Аномалии' },
    { to: '/procurement/suppliers', label: t('nav.suppliers') },
    { to: '/procurement/rules', label: 'Фильтры товаров' },
    { to: '/prices', label: t('nav.prices') },
    { to: '/forecast', label: t('nav.forecast') },
    { to: '/foodcost', label: t('nav.foodcost') },
    { to: '/stock', label: t('nav.stock') },
    { to: '/settings', label: t('nav.settings') },
    { to: '/settings/notifications', label: 'Уведомления' },
    { to: '/settings/integrations', label: t('nav.integrations') },
  ];

  if (user?.role === 'super_admin' || user?.role === 'org_admin') {
    links.push({ to: '/settings/telegram', label: t('nav.telegram') });
  }
  if (user?.role === 'super_admin') {
    links.push({ to: '/settings/admin', label: 'Админ платформы' });
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/40 md:hidden"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl bg-white shadow-2xl',
          'border-t border-[var(--border)] max-h-[70vh] flex flex-col',
          'pb-[env(safe-area-inset-bottom)]'
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" />
        <p className="px-4 pt-3 pb-2 text-sm font-semibold text-slate-800">{t('nav.more')}</p>
        <nav className="overflow-y-auto px-2 pb-4">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={onClose}
              className="flex min-h-[48px] items-center rounded-xl px-4 py-3 text-sm text-slate-800 hover:bg-slate-50 active:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
