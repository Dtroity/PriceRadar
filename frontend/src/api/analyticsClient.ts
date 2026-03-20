import { request } from './client';

export interface PriceHistoryResponse {
  product: { id: string; name: string; unit: string | null };
  series: Array<{
    supplier: { id: string; name: string };
    points: Array<{ date: string; price: number; document_id: string | null }>;
  }>;
  stats: { min_price: number; max_price: number; avg_price: number; price_change_pct: number };
}

export interface BestSuppliersResponse {
  suppliers: Array<{
    supplier: { id: string; name: string };
    avg_price: number;
    min_price: number;
    delivery_count: number;
    price_stability: number;
    score: number;
  }>;
}

export interface PriceSummaryResponse {
  top_growing: Array<{
    product: { id: string; name: string };
    change_pct: number;
    current_price: number;
  }>;
  top_falling: Array<{
    product: { id: string; name: string };
    change_pct: number;
    current_price: number;
  }>;
  anomalies_count: number;
  total_products_tracked: number;
}

export interface AnomalyRow {
  id: string;
  organization_id: string;
  product_id: string;
  supplier_id: string | null;
  detected_at: string;
  price_before: string;
  price_after: string;
  change_pct: string;
  direction: string;
  severity: string;
  document_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  product_name?: string;
  supplier_name?: string | null;
}

const q = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

export function fetchPriceHistory(params: {
  productId: string;
  dateFrom?: string;
  dateTo?: string;
  supplierId?: string;
  periodDays?: number;
}) {
  const { productId, supplierId, periodDays } = params;
  let dateFrom = params.dateFrom;
  let dateTo = params.dateTo;
  if (periodDays && !dateFrom) {
    const to = new Date();
    const from = new Date(to.getTime() - periodDays * 86400000);
    dateFrom = from.toISOString().slice(0, 10);
    dateTo = to.toISOString().slice(0, 10);
  }
  return request<PriceHistoryResponse>(
    `/analytics/prices/history${q({ product_id: productId, date_from: dateFrom, date_to: dateTo, supplier_id: supplierId })}`
  );
}

export function fetchBestSuppliers(params?: { productId?: string; periodDays?: number }) {
  return request<BestSuppliersResponse>(
    `/analytics/prices/best-suppliers${q({
      product_id: params?.productId,
      period_days: params?.periodDays,
    })}`
  );
}

export function fetchPriceSummary(periodDays?: number) {
  return request<PriceSummaryResponse>(`/analytics/prices/summary${q({ period_days: periodDays })}`);
}

export function fetchAnomalies(params?: {
  severity?: string;
  acknowledged?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  return request<{ anomalies: AnomalyRow[] }>(
    `/analytics/anomalies${q({
      severity: params?.severity,
      acknowledged:
        params?.acknowledged === undefined ? undefined : params.acknowledged ? 'true' : 'false',
      date_from: params?.dateFrom,
      date_to: params?.dateTo,
      limit: params?.limit,
      offset: params?.offset,
    })}`
  );
}

export function fetchUnreadAnomalyCount() {
  return request<{ count: number }>('/analytics/anomalies/unread-count');
}

export function acknowledgeAnomaly(id: string) {
  return request<{ ok: boolean }>(`/analytics/anomalies/${id}/acknowledge`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}
