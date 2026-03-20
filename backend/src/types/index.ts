/**
 * Proviator / Restaurant Procurement AI Platform - Backend types
 */
export type UserRole = 'super_admin' | 'org_admin' | 'manager';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  created_at: Date;
}

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  created_at: Date;
}

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  is_priority: boolean;
  created_at: Date;
}

export type SourceType = 'web' | 'telegram' | 'camera' | 'email';

export interface PriceList {
  id: string;
  supplier_id: string;
  upload_date: Date;
  source_type: SourceType;
  file_path: string | null;
  created_at: Date;
}

export interface Price {
  id: string;
  price_list_id: string;
  product_id: string;
  price: number;
  currency: string;
}

export interface PriceChange {
  id: string;
  product_id: string;
  supplier_id: string;
  old_price: number;
  new_price: number;
  change_value: number;
  change_percent: number;
  is_priority: boolean;
  created_at: Date;
  product_name?: string;
  supplier_name?: string;
}

export interface TelegramUser {
  id: string;
  telegram_id: string;
  organization_id: string;
  username: string | null;
  role: string;
  is_allowed: boolean;
  created_at: Date;
}

export type DocumentStatus =
  | 'pending'
  | 'parsed'
  | 'needs_review'
  | 'verified'
  | 'failed'
  | 'ocr_failed';

export type DocumentParseSource = 'llm' | 'rules';

export interface Document {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  document_number: string | null;
  document_date: string | null;
  file_path: string;
  source_type: SourceType;
  status: DocumentStatus;
  confidence: number | null;
  ocr_confidence: number | null;
  ocr_engine: string | null;
  parse_source: string | null;
  total_amount: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  line_index: number;
  name: string | null;
  quantity: number;
  unit: string | null;
  price: number | null;
  sum: number | null;
  vat: number | null;
  product_id: string | null;
  needs_review: boolean;
  created_at: Date;
}

export interface PriceForecast {
  id: string;
  organization_id: string;
  product_id: string;
  supplier_id: string | null;
  forecast_date: string;
  horizon_days: number;
  predicted_price: number;
  created_at: Date;
}

export interface IntegrationCredentials {
  id: string;
  organization_id: string;
  provider: 'iiko' | 'rkeeper' | 'poster';
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface NormalizedRow {
  product_name: string;
  normalized_name: string;
  price: number;
  currency: string;
  supplier?: string;
}

export interface JwtPayload {
  userId: string;
  organizationId?: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}
