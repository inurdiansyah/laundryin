-- Add workflow array to layanan
ALTER TABLE layanan ADD COLUMN workflow text[] NOT NULL DEFAULT '{}';

-- Backfill layanan workflow based on name patterns
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']
WHERE workflow = '{}' OR workflow IS NULL;

-- Setrika-only services
UPDATE layanan SET workflow = ARRAY['diterima','setrika','siap_diambil','selesai']
WHERE (nama ILIKE '%setrika%' OR nama ILIKE '%gosok%')
  AND NOT (nama ILIKE '%cuci%' OR nama ILIKE '%laundry%');

-- Cuci-only services
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','proses_kering','siap_diambil','selesai']
WHERE (nama ILIKE '%cuci%' OR nama ILIKE '%laundry%')
  AND NOT (nama ILIKE '%setrika%' OR nama ILIKE '%gosok%');

-- Cuci + Setrika combo
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']
WHERE (nama ILIKE '%cuci%' OR nama ILIKE '%laundry%')
  AND (nama ILIKE '%setrika%' OR nama ILIKE '%gosok%');

-- Express services
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']
WHERE nama ILIKE '%express%' OR nama ILIKE '%kilat%';

-- Add workflow array to orders
ALTER TABLE orders ADD COLUMN workflow text[] NOT NULL DEFAULT '{}';

-- Backfill orders workflow from first layanan in order_items (order by id since no created_at)
UPDATE orders o SET workflow = (
  SELECT l.workflow FROM order_items oi
  JOIN layanan l ON oi.layanan_id = l.id
  WHERE oi.order_id = o.id
  ORDER BY oi.id LIMIT 1
)
WHERE workflow = '{}' OR workflow IS NULL;

-- Fallback
UPDATE orders SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']
WHERE workflow = '{}' OR workflow IS NULL;

-- Add jalur option for delivery both ways
ALTER TYPE order_jalur ADD VALUE IF NOT EXISTS 'jemput_antar';
