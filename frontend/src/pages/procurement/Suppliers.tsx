import Suppliers from '../Suppliers';
import { useT } from '../../i18n/LocaleContext';

export default function ProcurementSuppliers() {
  const t = useT();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Закупки · {t('procurement.suppliers')}</h1>
      <p className="text-slate-600">
        Управляйте поставщиками и фильтрами товаров (ключевые слова), которые задают, какие позиции могут
        попадать в заказы по каждому поставщику.
      </p>
      <Suppliers embedded />
    </div>
  );
}
