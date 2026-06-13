-- =====================================================
-- Notifications Log — audit trail for WhatsApp messages
-- Tracks every WA message sent with delivery status
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nomor_tujuan TEXT NOT NULL,
  template TEXT NOT NULL,
  pesan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'terkirim' CHECK (status IN ('terkirim', 'gagal')),
  error_detail TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_log_tenant ON notifications_log(tenant_id, created_at DESC);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_log_select" ON notifications_log
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "notifications_log_insert" ON notifications_log
  FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));
