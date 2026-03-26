import { request } from './client';

export type ProcurementOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'received'
  | 'cancelled';

export interface ProcurementOrder {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string | null;
  status: ProcurementOrderStatus;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: string;
  unit: string | null;
  target_price: string | null;
  actual_price: string | null;
  supplier_id: string | null;
  note: string | null;
  product_name?: string;
}

export interface ProcurementOrderDetail extends ProcurementOrder {
  items: ProcurementItem[];
  total_sum: number;
}

export type RecReason = 'low_stock' | 'price_drop' | 'regular_cycle';

export interface ProcurementRecommendation {
  id: string;
  organization_id: string;
  product_id: string;
  supplier_id: string | null;
  reason: RecReason;
  suggested_qty: string | null;
  suggested_price: string | null;
  priority: number;
  status: string;
  generated_at: string;
  expires_at: string | null;
  order_id: string | null;
  product_name?: string;
  supplier_name?: string | null;
}

function q(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

export async function listOrders(filters?: {
  status?: string;
  date_from?: string;
  date_to?: string;
  supplier_id?: string;
}): Promise<ProcurementOrder[]> {
  const res = await request<{ orders: ProcurementOrder[] }>(
    `/procurement/orders${q(filters ?? {})}`
  );
  return res.orders;
}

export async function createOrder(body: {
  title?: string;
  supplier_id?: string;
  notes?: string;
  items?: Array<{
    product_id: string;
    quantity: number;
    unit?: string;
    target_price?: number;
    supplier_id?: string;
  }>;
}): Promise<ProcurementOrder> {
  return request<ProcurementOrder>('/procurement/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getOrder(id: string): Promise<ProcurementOrderDetail> {
  return request<ProcurementOrderDetail>(`/procurement/orders/${id}`);
}

export async function patchOrder(
  id: string,
  body: Partial<{
    title: string | null;
    supplier_id: string | null;
    notes: string | null;
  }>
): Promise<ProcurementOrder> {
  return request<ProcurementOrder>(`/procurement/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function patchOrderStatus(id: string, status: ProcurementOrderStatus): Promise<ProcurementOrder> {
  return request<ProcurementOrder>(`/procurement/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function addOrderItem(
  orderId: string,
  body: {
    product_id: string;
    quantity: number;
    unit?: string;
    target_price?: number;
    supplier_id?: string;
  }
): Promise<ProcurementItem> {
  return request<ProcurementItem>(`/procurement/orders/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchOrderItem(
  orderId: string,
  itemId: string,
  body: Partial<{ quantity: number; actual_price: number | null; note: string | null }>
): Promise<ProcurementItem> {
  return request<ProcurementItem>(`/procurement/orders/${orderId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteOrderItem(orderId: string, itemId: string): Promise<void> {
  await request<{ ok: boolean }>(`/procurement/orders/${orderId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function priceHint(productId: string): Promise<{
  target_price: number | null;
  supplier_id: string | null;
}> {
  return request(`/procurement/price-hint${q({ product_id: productId })}`);
}

export async function listRecommendations(filters?: {
  reason?: RecReason;
  priority_max?: string;
}): Promise<ProcurementRecommendation[]> {
  const res = await request<{ recommendations: ProcurementRecommendation[] }>(
    `/procurement/recommendations${q((filters ?? {}) as Record<string, string | undefined>)}`
  );
  return res.recommendations;
}

export async function generateRecommendations(): Promise<{ created: number }> {
  return request<{ created: number }>('/procurement/recommendations/generate', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function acceptRecommendation(id: string): Promise<{ ok: boolean; order_id: string }> {
  return request(`/procurement/recommendations/${id}/accept`, { method: 'PATCH', body: '{}' });
}

export async function dismissRecommendation(id: string): Promise<{ ok: boolean }> {
  return request(`/procurement/recommendations/${id}/dismiss`, { method: 'PATCH', body: '{}' });
}
