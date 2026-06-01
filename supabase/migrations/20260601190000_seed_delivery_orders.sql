-- =====================================================
-- Seed Data: Pengantaran untuk Demo Tenant (Gevana)
-- =====================================================

-- Main seed block
do $$
declare
  v_tenant_id uuid;
  cust_siti   uuid;
  cust_budi   uuid;
  cust_dewi   uuid;
  cust_ahmad  uuid;
  cust_rina   uuid;
  drv_indra   uuid;
  drv_rudi    uuid;
  drv_bayu    uuid;
  lid_cuci_kering uuid;
  lid_cuci_basah  uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; o6 uuid;
  today date := current_date;
begin
  -- Get the actual Gevana tenant ID
  select id into v_tenant_id from public.tenants where slug = 'gevana-laundry' limit 1;
  if v_tenant_id is null then
    raise notice 'Gevana tenant not found, skipping delivery seed';
    return;
  end if;
  -- Get or create customers
  select id into cust_siti  from public.customers where tenant_id = v_tenant_id and nomor_hp = '0812-1111-1111';
  if cust_siti is null then
    insert into public.customers (tenant_id, nama, nomor_hp, alamat) values (v_tenant_id, 'Siti Rahmawati', '0812-1111-1111', 'Perumahan Griya Asri Blok A5, Pamulang') returning id into cust_siti;
  end if;
  select id into cust_budi  from public.customers where tenant_id = v_tenant_id and nomor_hp = '0813-2222-2222';
  if cust_budi is null then
    insert into public.customers (tenant_id, nama, nomor_hp, alamat) values (v_tenant_id, 'Budi Santoso', '0813-2222-2222', 'Jl. Merpati No. 45, Pondok Benda') returning id into cust_budi;
  end if;
  select id into cust_dewi  from public.customers where tenant_id = v_tenant_id and nomor_hp = '0856-3333-3333';
  if cust_dewi is null then
    insert into public.customers (tenant_id, nama, nomor_hp, alamat) values (v_tenant_id, 'Dewi Lestari', '0856-3333-3333', 'Komplek Bumi Indah Blok C12, Pamulang') returning id into cust_dewi;
  end if;
  select id into cust_ahmad from public.customers where tenant_id = v_tenant_id and nomor_hp = '0878-4444-4444';
  if cust_ahmad is null then
    insert into public.customers (tenant_id, nama, nomor_hp, alamat) values (v_tenant_id, 'Ahmad Fauzi', '0878-4444-4444', 'Jl. Anggrek No. 78, Pondok Benda') returning id into cust_ahmad;
  end if;
  select id into cust_rina  from public.customers where tenant_id = v_tenant_id and nomor_hp = '0812-5555-5555';
  if cust_rina is null then
    insert into public.customers (tenant_id, nama, nomor_hp, alamat) values (v_tenant_id, 'Rina Marlina', '0812-5555-5555', 'Perumahan Pondok Indah Blok D3, Pamulang') returning id into cust_rina;
  end if;

  -- Get or create driver IDs
  select id into drv_indra from public.drivers where tenant_id = v_tenant_id and nomor_hp = '0812-7777-0001';
  if drv_indra is null then
    insert into public.drivers (tenant_id, nama, nomor_hp, status) values (v_tenant_id, 'Indra Gunawan', '0812-7777-0001', 'aktif') returning id into drv_indra;
  end if;
  select id into drv_rudi  from public.drivers where tenant_id = v_tenant_id and nomor_hp = '0813-7777-0002';
  if drv_rudi is null then
    insert into public.drivers (tenant_id, nama, nomor_hp, status) values (v_tenant_id, 'Rudi Hermawan', '0813-7777-0002', 'aktif') returning id into drv_rudi;
  end if;
  select id into drv_bayu  from public.drivers where tenant_id = v_tenant_id and nomor_hp = '0856-7777-0003';
  if drv_bayu is null then
    insert into public.drivers (tenant_id, nama, nomor_hp, status) values (v_tenant_id, 'Bayu Setiawan', '0856-7777-0003', 'aktif') returning id into drv_bayu;
  end if;

  -- Get or create layanan IDs
  select id into lid_cuci_kering from public.layanan where tenant_id = v_tenant_id and nama = 'Cuci, Kering, Setrika' limit 1;
  if lid_cuci_kering is null then
    insert into public.layanan (tenant_id, nama, satuan, harga, kategori, workflow) values (v_tenant_id, 'Cuci, Kering, Setrika', 'kg', 7000, 'cuci', ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']) returning id into lid_cuci_kering;
  end if;
  select id into lid_cuci_basah  from public.layanan where tenant_id = v_tenant_id and nama = 'Cuci Basah' limit 1;
  if lid_cuci_basah is null then
    insert into public.layanan (tenant_id, nama, satuan, harga, kategori, workflow) values (v_tenant_id, 'Cuci Basah', 'kg', 5000, 'cuci', ARRAY['diterima','proses_cuci','siap_diambil','selesai']) returning id into lid_cuci_basah;
  end if;

  -- ============================================
  -- Order 1: jemput_antar — Jemput + Antar
  -- Status: menunggu_jemput (belum dijemput)
  -- ============================================
  insert into public.orders (
    tenant_id, customer_id, nomor_order, status, jalur,
    waktu_bayar, berat_total, subtotal, total, workflow, catatan
  ) values (
    v_tenant_id, cust_siti, 'LD-0001',
    'menunggu_jemput', 'jemput_antar', 'awal', 5, 35000, 35000,
    ARRAY['menunggu_jemput','dijemput_driver','diterima','proses_cuci','proses_kering','setrika','siap_diantar','dalam_pengiriman','selesai']::text[],
    'Cuci Kering Setrika 5kg — jemput + antar'
  ) returning id into o1;

  -- Delivery: jemput (terjadwal, belum ada driver)
  insert into public.delivery_schedules (tenant_id, order_id, alamat, tanggal, slot_waktu, tipe, status)
  values (v_tenant_id, o1, 'Perumahan Griya Asri Blok A5, Pamulang', today, 'pagi', 'jemput', 'terjadwal');

  -- Delivery: antar (terjadwal, belum ada driver)
  insert into public.delivery_schedules (tenant_id, order_id, alamat, tanggal, slot_waktu, tipe, status)
  values (v_tenant_id, o1, 'Perumahan Griya Asri Blok A5, Pamulang', today + 2, 'sore', 'antar', 'terjadwal');

  -- ============================================
  -- Order 2: jemput_ambil — Jemput saja
  -- Status: dijemput_driver (sudah ada driver, sedang dalam perjalanan)
  -- ============================================
  insert into public.orders (
    tenant_id, customer_id, nomor_order, status, jalur,
    waktu_bayar, berat_total, subtotal, total, workflow, catatan
  ) values (
    v_tenant_id, cust_budi, 'LD-0002',
    'dijemput_driver', 'jemput_ambil', 'akhir', 3, 15000, 15000,
    ARRAY['menunggu_jemput','dijemput_driver','diterima','proses_cuci','siap_diambil','selesai']::text[],
    'Cuci Basah 3kg — jemput, ambil sendiri'
  ) returning id into o2;

  -- Delivery: jemput (driver_berangkat)
  insert into public.delivery_schedules (tenant_id, order_id, driver_id, alamat, tanggal, slot_waktu, tipe, status)
  values (v_tenant_id, o2, drv_indra, 'Jl. Merpati No. 45, Pondok Benda', today, 'pagi', 'jemput', 'driver_berangkat');

  -- ============================================
  -- Order 3: drop_antar — Customer drop, driver antar
  -- Status: siap_diantar (sudah diproses, siap diantar)
  -- ============================================
  insert into public.orders (
    tenant_id, customer_id, nomor_order, status, jalur,
    waktu_bayar, berat_total, subtotal, total, workflow, catatan
  ) values (
    v_tenant_id, cust_dewi, 'LD-0003',
    'siap_diantar', 'drop_antar', 'awal', 4, 28000, 28000,
    ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diantar','dalam_pengiriman','selesai']::text[],
    'Cuci Kering Setrika 4kg — drop, diantar'
  ) returning id into o3;

  -- Delivery: antar (terjadwal, belum ada driver)
  insert into public.delivery_schedules (tenant_id, order_id, alamat, tanggal, slot_waktu, tipe, status)
  values (v_tenant_id, o3, 'Komplek Bumi Indah Blok C12, Pamulang', today, 'sore', 'antar', 'terjadwal');

  -- ============================================
  -- Order 4: jemput_antar — Jemput + Antar (full service)
  -- Status: dalam_pengiriman (sedang diantar driver)
  -- ============================================
  insert into public.orders (
    tenant_id, customer_id, nomor_order, status, jalur,
    waktu_bayar, berat_total, subtotal, total, workflow, catatan
  ) values (
    v_tenant_id, cust_ahmad, 'LD-0004',
    'dalam_pengiriman', 'jemput_antar', 'akhir', 7, 49000, 49000,
    ARRAY['menunggu_jemput','dijemput_driver','diterima','proses_cuci','proses_kering','setrika','siap_diantar','dalam_pengiriman','selesai']::text[],
    'Cuci Kering Setrika 7kg — jemput + antar full'
  ) returning id into o4;

  -- Delivery: jemput (selesai)
  insert into public.delivery_schedules (tenant_id, order_id, driver_id, alamat, tanggal, slot_waktu, tipe, status)
  values (v_tenant_id, o4, drv_rudi, 'Jl. Anggrek No. 78, Pondok Benda', today - 1, 'pagi', 'jemput', 'selesai');

  -- Delivery: antar (driver_berangkat)
  insert into public.delivery_schedules (tenant_id, order_id, driver_id, alamat, tanggal, slot_waktu, tipe, status)
  values (v_tenant_id, o4, drv_rudi, 'Jl. Anggrek No. 78, Pondok Benda', today, 'sore', 'antar', 'driver_berangkat');

  -- ============================================
  -- Order 5: drop_ambil — No delivery (customer antar + ambil sendiri)
  -- Status: proses_cuci (sedang diproses)
  -- ============================================
  insert into public.orders (
    tenant_id, customer_id, nomor_order, status, jalur,
    waktu_bayar, berat_total, subtotal, total, workflow, catatan
  ) values (
    v_tenant_id, cust_rina, 'LD-0005',
    'proses_cuci', 'drop_ambil', 'awal', 2, 10000, 10000,
    ARRAY['diterima','proses_cuci','siap_diambil','selesai']::text[],
    'Cuci Basah 2kg — antar sendiri, ambil sendiri'
  ) returning id into o5;

  -- ============================================
  -- Order 6: jemput_ambil — Jemput saja, sudah selesai
  -- Status: selesai
  -- ============================================
  insert into public.orders (
    tenant_id, customer_id, nomor_order, status, jalur,
    waktu_bayar, berat_total, subtotal, total, workflow, catatan
  ) values (
    v_tenant_id, cust_siti, 'LD-0006',
    'selesai', 'jemput_ambil', 'awal', 12, 84000, 84000,
    ARRAY['menunggu_jemput','dijemput_driver','diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']::text[],
    'Cuci Kering Setrika 12kg — jemput, ambil sendiri'
  ) returning id into o6;

  -- Delivery: jemput (selesai)
  insert into public.delivery_schedules (tenant_id, order_id, driver_id, alamat, tanggal, slot_waktu, tipe, status)
  values (v_tenant_id, o6, drv_bayu, 'Perumahan Griya Asri Blok A5, Pamulang', today - 2, 'pagi', 'jemput', 'selesai');

  -- Insert order items for all 6 orders
  insert into public.order_items (order_id, layanan_id, nama_layanan, satuan, qty, harga_satuan, subtotal)
  values
    (o1, lid_cuci_kering, 'Cuci, Kering, Setrika', 'kg', 5, 7000, 35000),
    (o2, lid_cuci_basah, 'Cuci Basah', 'kg', 3, 5000, 15000),
    (o3, lid_cuci_kering, 'Cuci, Kering, Setrika', 'kg', 4, 7000, 28000),
    (o4, lid_cuci_kering, 'Cuci, Kering, Setrika', 'kg', 7, 7000, 49000),
    (o5, lid_cuci_basah, 'Cuci Basah', 'kg', 2, 5000, 10000),
    (o6, lid_cuci_kering, 'Cuci, Kering, Setrika', 'kg', 12, 7000, 84000);

  -- Insert order status logs
  insert into public.order_status_log (order_id, status, user_nama)
  values
    (o1, 'menunggu_jemput', 'Admin'),
    (o2, 'menunggu_jemput', 'Admin'),
    (o2, 'dijemput_driver', 'Admin'),
    (o3, 'diterima', 'Admin'),
    (o3, 'proses_cuci', 'Admin'),
    (o3, 'proses_kering', 'Admin'),
    (o3, 'setrika', 'Admin'),
    (o3, 'siap_diantar', 'Admin'),
    (o4, 'menunggu_jemput', 'Admin'),
    (o4, 'dijemput_driver', 'Admin'),
    (o4, 'diterima', 'Admin'),
    (o4, 'proses_cuci', 'Admin'),
    (o4, 'proses_kering', 'Admin'),
    (o4, 'setrika', 'Admin'),
    (o4, 'siap_diantar', 'Admin'),
    (o4, 'dalam_pengiriman', 'Admin'),
    (o5, 'diterima', 'Admin'),
    (o5, 'proses_cuci', 'Admin'),
    (o6, 'menunggu_jemput', 'Admin'),
    (o6, 'dijemput_driver', 'Admin'),
    (o6, 'diterima', 'Admin'),
    (o6, 'proses_cuci', 'Admin'),
    (o6, 'proses_kering', 'Admin'),
    (o6, 'setrika', 'Admin'),
    (o6, 'siap_diambil', 'Admin'),
    (o6, 'selesai', 'Admin');

end $$;
