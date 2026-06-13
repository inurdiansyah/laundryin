-- =====================================================
-- Tenant Configs — flexible key-value store per tenant
-- Used for: GoWA settings, notification prefs, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, config_key)
);

ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users in the same tenant to read/write configs
CREATE POLICY "tenant_configs_select" ON tenant_configs
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "tenant_configs_insert" ON tenant_configs
  FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "tenant_configs_update" ON tenant_configs
  FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "tenant_configs_delete" ON tenant_configs
  FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'admin'
  ));
