-- Add new enum values for order_jalur (must be separate from UPDATE)
ALTER TYPE order_jalur ADD VALUE IF NOT EXISTS 'drop_ambil';
ALTER TYPE order_jalur ADD VALUE IF NOT EXISTS 'drop_antar';
ALTER TYPE order_jalur ADD VALUE IF NOT EXISTS 'jemput_ambil';
