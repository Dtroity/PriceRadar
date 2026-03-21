import type { ProcurementOrderStatus } from '../../api/procurementClient';

const STYLES: Record<ProcurementOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-900',
  approved: 'bg-blue-100 text-blue-800',
  ordered: 'bg-orange-100 text-orange-900',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrderStatusBadge({
  status,
  label,
}: {
  status: ProcurementOrderStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {label}
    </span>
  );
}
