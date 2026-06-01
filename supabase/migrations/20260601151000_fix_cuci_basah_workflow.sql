-- Fix: Cuci Basah tidak perlu proses pengeringan
UPDATE layanan SET workflow = ARRAY['diterima','proses_cuci','siap_diambil','selesai']
WHERE nama ILIKE '%basah%';

-- Also fix any existing orders with Cuci Basah items that have wrong workflow
UPDATE orders o SET workflow = (
  SELECT l.workflow FROM order_items oi
  JOIN layanan l ON oi.layanan_id = l.id
  WHERE oi.order_id = o.id
  ORDER BY oi.id LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM order_items oi2
  JOIN layanan l2 ON oi2.layanan_id = l2.id
  WHERE oi2.order_id = o.id AND l2.nama ILIKE '%basah%'
)
AND (o.workflow = '{}' OR o.workflow IS NULL OR array_length(o.workflow, 1) > 4);
