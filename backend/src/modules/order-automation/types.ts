export type OrderStatus = 'draft' | 'queued' | 'sent' | 'accepted' | 'completed' | 'cancelled' | 'failed';

export interface SupplierOrder {
  id: string;
  organization_id: string;
  supplier_id: string;
  status: OrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  sent_at: Date | null;
  updated_at: Date;
}

export interface SupplierOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number | null;
  created_at: Date;
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  type: 'email' | 'telegram' | 'phone' | 'whatsapp' | 'api_endpoint';
  value: string;
  created_at: Date;
}

export interface SupplierOrderFilter {
  id: string;
  organization_id: string;
  supplier_id: string;
  keyword: string;
  priority: number;
  active: boolean;
  created_at: Date;
}

export interface AutomationRule {
  id: string;
  organization_id: string;
  rule_type: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  enabled: boolean;
  created_at: Date;
}

export interface SendOrderJobPayload {
  orderId: string;
  organizationId: string;
  channels: Array<'email' | 'telegram' | 'whatsapp' | 'api_endpoint'>;
}
