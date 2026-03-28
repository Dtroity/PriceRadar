-- Unified ingestion pipeline: history, classification, rollback
-- Apply on existing DB: run this file or rely on db/init.sql tail.

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  original_filename VARCHAR(500) NOT NULL,
  stored_path VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(200) NOT NULL,
  source_type VARCHAR(20) NOT NULL DEFAULT 'web',
  file_sha256 VARCHAR(64),
  suggested_kind VARCHAR(32) NOT NULL,
  confirmed_kind VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'pending_confirm',
  detection JSONB NOT NULL DEFAULT '{}',
  bullmq_job_id VARCHAR(64),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL,
  error_message TEXT,
  summary JSONB NOT NULL DEFAULT '{}',
  duplicate_of_id UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_org_created ON ingestion_jobs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_org_hash ON ingestion_jobs(organization_id, file_sha256);

ALTER TABLE price_changes ADD COLUMN IF NOT EXISTS source_price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE;
