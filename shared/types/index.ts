/**
 * Vizor360 - Shared types
 */

export type UserRole = 'super_admin' | 'org_admin' | 'manager';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: Date;
}

export interface Supplier {
  id: string;
  name: string;
  created_at: Date;
}

export interface Product {
  id: string;
  name: string;
  normalized_name: string;
  is_priority: boolean;
  created_at: Date;
}

export type SourceType = 'web' | 'telegram' | 'camera';

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
  username: string | null;
  role: string;
  is_allowed: boolean;
  created_at: Date;
}

export interface NormalizedRow {
  product_name: string;
  normalized_name: string;
  price: number;
  currency: string;
  supplier?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}
