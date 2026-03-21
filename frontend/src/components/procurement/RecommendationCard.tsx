import type { ProcurementRecommendation } from '../../api/procurementClient';
import { useT } from '../../i18n/LocaleContext';

function reasonIcon(reason: string): string {
  if (reason === 'low_stock') return '📉';
  if (reason === 'price_drop') return '💰';
  if (reason === 'regular_cycle') return '🔄';
  return '💡';
}

export default function RecommendationCard({
  rec,
  onAccept,
  onDismiss,
  busy,
}: {
  rec: ProcurementRecommendation;
  onAccept: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  const t = useT();
  const price =
    rec.suggested_price != null ? Number.parseFloat(rec.suggested_price).toFixed(2) : '—';
  const qty = rec.suggested_qty != null ? rec.suggested_qty : '—';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            <span className="mr-2" aria-hidden>
              {reasonIcon(rec.reason)}
            </span>
            {rec.product_name ?? rec.product_id}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t(`procurement.recReason.${rec.reason}`)}
            {rec.supplier_name ? ` · ${rec.supplier_name}` : ''}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            {t('procurement.recQty')}: {qty} · {t('procurement.recPrice')}: {price} · priority:{' '}
            {rec.priority}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {t('procurement.recAccept')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
          >
            {t('procurement.recDismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
