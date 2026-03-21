export type ProcurementOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'received'
  | 'cancelled';

export const ALLOWED_TRANSITIONS: Record<ProcurementOrderStatus, ProcurementOrderStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

export function canTransition(
  from: ProcurementOrderStatus,
  to: ProcurementOrderStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
