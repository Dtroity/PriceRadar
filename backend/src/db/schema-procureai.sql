-- ProcureAI / Restaurant Procurement AI Platform
-- Multi-tenant schema

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (one per restaurant/workspace)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Users (scoped to organization)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'manager' CHECK (role IN ('super_admin', 'org_admin', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Suppliers (per organization)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_suppliers_organization ON suppliers(organization_id);

-- Products (per organization)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  normalized_name VARCHAR(500) NOT NULL,
  is_priority BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_organization ON products(organization_id);
CREATE INDEX idx_products_normalized_name ON products(organization_id, normalized_name);
CREATE INDEX idx_products_is_priority ON products(organization_id, is_priority);

-- Product mapping: supplier product name -> organization product (fuzzy/AI matching)
CREATE TABLE IF NOT EXISTS product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_product_name VARCHAR(500) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  confidence DECIMAL(5, 2) NOT NULL DEFAULT 100.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, supplier_id, supplier_product_name)
);

CREATE INDEX idx_product_mapping_org_supplier ON product_mapping(organization_id, supplier_id);

-- Product aliases (legacy / alternative names per supplier)
CREATE TABLE IF NOT EXISTS product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255),
  alias_name VARCHAR(500),
  raw_name VARCHAR(500),
  normalized_name VARCHAR(500),
  confidence DECIMAL(5, 2) NOT NULL DEFAULT 100.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_aliases_organization ON product_aliases(organization_id);
CREATE INDEX idx_product_aliases_product ON product_aliases(product_id);
CREATE INDEX idx_product_aliases_raw_name ON product_aliases(organization_id, raw_name);
CREATE INDEX idx_product_aliases_normalized_name ON product_aliases(organization_id, normalized_name);

-- Priority products (explicit table optional; we keep is_priority on products)
-- CREATE TABLE IF NOT EXISTS priority_products (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   organization_id UUID NOT NULL REFERENCES organizations(id),
--   product_id UUID NOT NULL REFERENCES products(id),
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Price lists (per supplier)
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  upload_date DATE NOT NULL,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('web', 'telegram', 'camera', 'email')),
  file_path VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_price_lists_organization ON price_lists(organization_id);
CREATE INDEX idx_price_lists_supplier ON price_lists(supplier_id);
CREATE INDEX idx_price_lists_upload_date ON price_lists(upload_date);

-- Prices (per price list)
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'RUB'
);

CREATE INDEX idx_prices_price_list ON prices(price_list_id);
CREATE INDEX idx_prices_product ON prices(product_id);

-- Price changes (for monitoring)
CREATE TABLE IF NOT EXISTS price_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  old_price DECIMAL(12, 2) NOT NULL,
  new_price DECIMAL(12, 2) NOT NULL,
  change_value DECIMAL(12, 2) NOT NULL,
  change_percent DECIMAL(8, 2) NOT NULL,
  is_priority BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_price_changes_organization ON price_changes(organization_id);
CREATE INDEX idx_price_changes_created ON price_changes(created_at DESC);
CREATE INDEX idx_price_changes_supplier ON price_changes(supplier_id);
CREATE INDEX idx_price_changes_priority ON price_changes(is_priority);

-- Price forecasts (7/14/30 days from AI service)
CREATE TABLE IF NOT EXISTS price_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  forecast_date DATE NOT NULL,
  horizon_days INT NOT NULL CHECK (horizon_days IN (7, 14, 30)),
  predicted_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_price_forecasts_organization ON price_forecasts(organization_id);
CREATE INDEX idx_price_forecasts_product ON price_forecasts(product_id);
CREATE INDEX idx_price_forecasts_date ON price_forecasts(forecast_date);

-- Documents (invoices / uploaded files)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255),
  document_number VARCHAR(100),
  document_date DATE,
  file_path VARCHAR(1000) NOT NULL,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('web', 'telegram', 'camera', 'email')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'needs_review', 'verified', 'failed')),
  confidence DECIMAL(5, 2),
  total_amount DECIMAL(14, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_organization ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_date ON documents(document_date);

-- Document line items (parsed from invoice)
CREATE TABLE IF NOT EXISTS document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  line_index INT NOT NULL,
  name VARCHAR(500),
  quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  price DECIMAL(12, 2),
  sum DECIMAL(14, 2),
  vat DECIMAL(5, 2),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  needs_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_document_items_document ON document_items(document_id);

-- Telegram users (per organization)
CREATE TABLE IF NOT EXISTS telegram_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id VARCHAR(50) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  username VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user',
  is_allowed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, telegram_id)
);

CREATE INDEX idx_telegram_users_organization ON telegram_users(organization_id);
CREATE INDEX idx_telegram_users_telegram_id ON telegram_users(telegram_id);

-- Integration credentials (iiko / R-keeper / Poster)
CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('iiko', 'rkeeper', 'poster')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, provider)
);

CREATE INDEX idx_integration_credentials_organization ON integration_credentials(organization_id);

-- AI feedback (corrections for auto-learning)
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_item_id UUID NOT NULL REFERENCES document_items(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_ai_feedback_organization ON ai_feedback(organization_id);

-- iiko product mapping
CREATE TABLE IF NOT EXISTS iiko_products_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  iiko_product_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, product_id)
);
CREATE INDEX idx_iiko_products_mapping_org ON iiko_products_mapping(organization_id);

-- FoodCost Engine
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_recipes_organization ON recipes(organization_id);

CREATE TABLE IF NOT EXISTS recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 4) NOT NULL,
  unit VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_recipe_items_recipe ON recipe_items(recipe_id);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  selling_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_menu_items_organization ON menu_items(organization_id);

CREATE TABLE IF NOT EXISTS food_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  cost DECIMAL(12, 2) NOT NULL,
  margin DECIMAL(12, 2) NOT NULL,
  food_cost_percent DECIMAL(5, 2) NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_food_cost_history_menu_item ON food_cost_history(menu_item_id);

CREATE TABLE IF NOT EXISTS foodcost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  food_cost_percent DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed'))
);
CREATE INDEX idx_foodcost_alerts_menu_item ON foodcost_alerts(menu_item_id);

-- Supplier Intelligence
CREATE TABLE IF NOT EXISTS supplier_prices_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_supplier_prices_history_org ON supplier_prices_history(organization_id);
CREATE INDEX idx_supplier_prices_history_supplier_product ON supplier_prices_history(supplier_id, product_id);

CREATE TABLE IF NOT EXISTS supplier_score (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  price_score DECIMAL(5, 2),
  stability_score DECIMAL(5, 2),
  availability_score DECIMAL(5, 2),
  total_score DECIMAL(5, 2),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(supplier_id, organization_id)
);
CREATE INDEX idx_supplier_score_organization ON supplier_score(organization_id);

-- SaaS subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  max_users INT,
  max_documents INT,
  max_products INT,
  price DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'trial')),
  renewal_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing errors (document worker retries)
CREATE TABLE IF NOT EXISTS processing_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_processing_errors_document ON processing_errors(document_id);

-- API keys for public integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_api_keys_organization ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key ON api_keys(key);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- For existing DBs that had documents before confidence column was added:
ALTER TABLE documents ADD COLUMN IF NOT EXISTS confidence DECIMAL(5, 2);

-- Product alias normalization fields (non-AI deduplication)
ALTER TABLE product_aliases ADD COLUMN IF NOT EXISTS raw_name VARCHAR(500);
ALTER TABLE product_aliases ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(500);
CREATE INDEX IF NOT EXISTS idx_product_aliases_raw_name ON product_aliases(organization_id, raw_name);
CREATE INDEX IF NOT EXISTS idx_product_aliases_normalized_name ON product_aliases(organization_id, normalized_name);
