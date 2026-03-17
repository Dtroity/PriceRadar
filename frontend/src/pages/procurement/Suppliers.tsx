import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LocaleContext';

export default function ProcurementSuppliers() {
  const t = useT();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Procurement · {t('procurement.suppliers')}</h1>
      <p className="text-slate-600">{t('procurement.suppliersDescription')}</p>
      <p className="text-sm text-slate-500">
        <Link to="/suppliers" className="underline">{t('nav.suppliers')}</Link>{' '}
        — <code className="rounded bg-slate-100 px-1">POST /api/order-automation/suppliers/:id/contacts</code>
      </p>
    </div>
  );
}
