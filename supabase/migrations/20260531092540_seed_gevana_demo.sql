-- =====================================================
-- Seed Data: Gevana Laundry (Demo Tenant)
-- =====================================================

-- Demo Tenant
insert into public.tenants (id, slug, nama, alamat, nomor_hp, email, paket, status)
values (
	'00000000-0000-0000-0000-000000000001',
	'gevana',
	'Gevana Laundry',
	'Jl. Pondok Benda No. 123, Pamulang, Tangerang Selatan',
	'0812-3456-7890',
	'demo@gevana-laundry.com',
	'pro',
	'aktif'
) on conflict (slug) do nothing;

-- Default services will be auto-created by trigger handle_new_tenant
-- Tapi karena tenant sudah ada, tambah manual jika belum ada
insert into public.layanan (tenant_id, nama, satuan, harga)
select
	'00000000-0000-0000-0000-000000000001',
	vals.nama,
	vals.satuan,
	vals.harga
from (values
	('Cuci Kering', 'kg'::satuan_layanan, 5000),
	('Cuci Basah', 'kg'::satuan_layanan, 5000),
	('Cuci, Kering, Setrika', 'kg'::satuan_layanan, 7000),
	('Cuci Ekspres', 'kg'::satuan_layanan, 9000),
	('Setrika Saja', 'kg'::satuan_layanan, 3000)
) as vals(nama, satuan, harga)
where not exists (
	select 1 from public.layanan
	where tenant_id = '00000000-0000-0000-0000-000000000001'
	and nama = vals.nama
);

-- Demo pelanggan (sample)
insert into public.customers (tenant_id, nama, nomor_hp, alamat)
select
	'00000000-0000-0000-0000-000000000001',
	vals.nama,
	vals.nomor_hp,
	vals.alamat
from (values
	('Siti Rahmawati', '0812-1111-1111', 'Perumahan Griya Asri Blok A5, Pamulang'),
	('Budi Santoso', '0813-2222-2222', 'Jl. Merpati No. 45, Pondok Benda'),
	('Dewi Lestari', '0856-3333-3333', 'Komplek Bumi Indah Blok C12, Pamulang'),
	('Ahmad Fauzi', '0878-4444-4444', 'Jl. Anggrek No. 78, Pondok Benda'),
	('Rina Marlina', '0812-5555-5555', 'Perumahan Pondok Indah Blok D3, Pamulang')
) as vals(nama, nomor_hp, alamat)
where not exists (
	select 1 from public.customers
	where tenant_id = '00000000-0000-0000-0000-000000000001'
	and nomor_hp = vals.nomor_hp
);
