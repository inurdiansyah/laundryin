-- Fix: Re-backfill workflow for all layanan and orders

-- Re-backfill layanan workflow based on current names
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']
WHERE workflow = '{}' OR workflow IS NULL;

-- Setrika-only services (name contains 'setrika' but NOT 'cuci')
UPDATE layanan SET workflow = ARRAY['diterima','setrika','siap_diambil','selesai']
WHERE (nama ILIKE '%setrika%' OR nama ILIKE '%gosok%')
  AND NOT (nama ILIKE '%cuci%' OR nama ILIKE '%laundry%')
  AND (workflow = '{}' OR workflow IS NULL OR workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']);

-- Cuci-only services (name contains 'cuci' but NOT 'setrika' AND NOT 'basah')
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','proses_kering','siap_diambil','selesai']
WHERE (nama ILIKE '%cuci%' OR nama ILIKE '%laundry%')
  AND NOT (nama ILIKE '%setrika%' OR nama ILIKE '%gosok%')
  AND NOT (nama ILIKE '%basah%')
  AND (workflow = '{}' OR workflow IS NULL OR workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']);

-- Cuci Basah (no pengeringan)
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','siap_diambil','selesai']
WHERE nama ILIKE '%basah%'
  AND (workflow = '{}' OR workflow IS NULL OR workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']);

-- Cuci + Setrika combo (name contains both)
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']
WHERE (nama ILIKE '%cuci%' OR nama ILIKE '%laundry%')
  AND (nama ILIKE '%setrika%' OR nama ILIKE '%gosok%')
  AND (workflow = '{}' OR workflow IS NULL OR workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']);

-- Re-backfill orders workflow from first layanan in order_items
UPDATE orders o SET workflow = (
  SELECT l.workflow FROM order_items oi
  JOIN layanan l ON oi.layanan_id = l.id
  WHERE oi.order_id = o.id
  ORDER BY oi.id LIMIT 1
)
WHERE workflow = '{}' OR workflow IS NULL;

-- Fallback for orders without items
UPDATE orders SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']
WHERE workflow = '{}' OR workflow IS NULL;
