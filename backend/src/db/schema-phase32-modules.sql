-- ProcureAI Phase 3.2: Modular SaaS + Order Automation

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS plan_modules (
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (plan_id, module_key)
);
CREATE INDEX IF NOT EXISTS idx_plan_modules_key ON plan_modules(module_key);

ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS renewal_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_org ON supplier_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier ON supplier_orders(supplier_id);

CREATE TABLE IF NOT EXISTS supplier_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(14, 4) NOT NULL,
  price NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_order ON supplier_order_items(order_id);

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT supplier_contacts_type_check CHECK (type IN ('email', 'telegram', 'phone', 'whatsapp', 'api_endpoint'))
);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON supplier_contacts(supplier_id);

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(organization_id);

CREATE TABLE IF NOT EXISTS supplier_order_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_order_filters_org ON supplier_order_filters(organization_id);

INSERT INTO modules (key, name, description) VALUES
  ('price_monitoring', 'Price monitoring', 'Uploads, price lists, change alerts'),
  ('invoice_ai', 'Invoice AI', 'OCR, document parsing, verification'),
  ('forecast', 'Forecast', 'Price forecasts'),
  ('foodcost', 'FoodCost', 'Recipes, menu cost, alerts'),
  ('supplier_intelligence', 'Supplier intelligence', 'Scores, history, recommendations'),
  ('order_automation', 'Order automation', 'Supplier orders, sending'),
  ('ai_procurement_agent', 'AI procurement agent', 'Recommended orders and savings'),
  ('telegram_bot', 'Telegram bot', 'Telegram integration'),
  ('iiko_integration', 'iiko integration', 'POS / iiko')
ON CONFLICT (key) DO NOTHING;
