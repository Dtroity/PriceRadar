-- ProcureAI Phase 3.4: Stock Intelligence + Procurement Autopilot

CREATE TABLE IF NOT EXISTS product_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  current_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_product_stock_org ON product_stock(organization_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(14, 4) NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('invoice', 'manual', 'recipe_usage', 'correction')),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON stock_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);

CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  autopilot_mode TEXT NOT NULL DEFAULT 'disabled' CHECK (autopilot_mode IN ('disabled', 'recommend_only', 'auto_generate', 'auto_send')),
  autopilot_days_threshold INT NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO modules (key, name, description) VALUES
  ('stock', 'Stock intelligence', 'Stock levels, movements, forecast'),
  ('procurement_autopilot', 'Procurement autopilot', 'Auto order recommendations and generation')
ON CONFLICT (key) DO NOTHING;
