-- =====================================================
-- LaundryIn — Database Schema
-- Multi-tenant SaaS untuk manajemen laundry
-- =====================================================

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";

-- 2. ENUM TYPES
create type user_role as enum ('admin', 'kasir', 'driver');
create type tenant_paket as enum ('free', 'starter', 'pro');
create type tenant_status as enum ('aktif', 'trial', 'suspend');
create type order_status as enum (
	'diterima',
	'menunggu_jemput',
	'dijemput_driver',
	'proses_cuci',
	'proses_kering',
	'setrika',
	'siap_diambil',
	'siap_diantar',
	'dalam_pengiriman',
	'terkirim',
	'selesai'
);
create type order_jalur as enum ('antar_sendiri', 'jemput');
create type status_bayar as enum ('lunas', 'belum_lunas', 'sebagian');
create type waktu_bayar as enum ('awal', 'akhir');
create type metode_bayar as enum ('tunai', 'transfer', 'gopay', 'ovo', 'dana', 'shopeepay', 'qris');
create type satuan_layanan as enum ('kg', 'piece', 'set');
create type tipe_mutasi as enum ('masuk', 'keluar');
create type driver_status as enum ('aktif', 'tidak_aktif');
create type slot_waktu as enum ('pagi', 'siang', 'sore');
create type tipe_delivery as enum ('jemput', 'antar');
create type delivery_status as enum ('terjadwal', 'driver_berangkat', 'dijemput', 'tiba_di_laundry', 'selesai');
create type member_tier as enum ('regular', 'silver', 'gold', 'platinum');
create type tipe_poin as enum ('masuk', 'keluar');
create type notif_status as enum ('terkirim', 'gagal');
create type kategori_pengeluaran as enum ('bahan_baku', 'operasional', 'gaji', 'perawatan_mesin', 'transport', 'lain_lain');
create type tipe_promo as enum ('persen', 'nominal');

-- 3. TABLES

-- Tenants
create table if not exists public.tenants (
	id uuid primary key default gen_random_uuid(),
	slug text unique not null,
	nama text not null,
	logo text,
	alamat text,
	nomor_hp text,
	email text,
	jam_operasional jsonb default '{}'::jsonb,
	paket tenant_paket not null default 'free',
	status tenant_status not null default 'aktif',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Tenant Users (profil user dalam tenant)
create table if not exists public.tenant_users (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	email text not null,
	nama text not null,
	role user_role not null default 'kasir',
	user_id uuid references auth.users(id) on delete set null,
	aktif boolean not null default true,
	created_at timestamptz not null default now()
);

-- Layanan (jasa per tenant)
create table if not exists public.layanan (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nama text not null,
	satuan satuan_layanan not null default 'kg',
	harga bigint not null,
	aktif boolean not null default true,
	created_at timestamptz not null default now()
);

-- Pelanggan
create table if not exists public.customers (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nama text not null,
	nomor_hp text not null,
	alamat text,
	total_belanja bigint not null default 0,
	created_at timestamptz not null default now()
);

-- Orders
create table if not exists public.orders (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nomor_order text not null,
	customer_id uuid not null references public.customers(id),
	status order_status not null default 'diterima',
	jalur order_jalur not null default 'antar_sendiri',
	berat_total numeric(10,2) not null default 0,
	subtotal bigint not null default 0,
	diskon bigint not null default 0,
	total bigint not null default 0,
	status_bayar status_bayar not null default 'belum_lunas',
	waktu_bayar waktu_bayar not null default 'akhir',
	estimasi_selesai timestamptz,
	catatan text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Order Items
create table if not exists public.order_items (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public.orders(id) on delete cascade,
	layanan_id uuid not null references public.layanan(id),
	nama_layanan text not null,
	qty numeric(10,2) not null default 1,
	satuan satuan_layanan not null default 'kg',
	harga_satuan bigint not null,
	subtotal bigint not null default 0
);

-- Order Status Log (riwayat perubahan status)
create table if not exists public.order_status_log (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public.orders(id) on delete cascade,
	status order_status not null,
	user_id uuid references auth.users(id),
	user_nama text,
	created_at timestamptz not null default now()
);

-- Pembayaran
create table if not exists public.payments (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	order_id uuid not null references public.orders(id) on delete cascade,
	metode metode_bayar not null default 'tunai',
	nominal bigint not null,
	status status_bayar not null default 'lunas',
	bukti_url text,
	created_at timestamptz not null default now()
);

-- Inventori
create table if not exists public.inventory_items (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nama text not null,
	kategori text not null default 'lainnya',
	satuan text not null default 'pcs',
	stok numeric(10,2) not null default 0,
	stok_minimum numeric(10,2) not null default 0,
	harga_beli bigint not null default 0,
	created_at timestamptz not null default now()
);

-- Mutasi Inventori
create table if not exists public.inventory_movements (
	id uuid primary key default gen_random_uuid(),
	item_id uuid not null references public.inventory_items(id) on delete cascade,
	tipe tipe_mutasi not null,
	qty numeric(10,2) not null,
	keterangan text,
	created_at timestamptz not null default now()
);

-- Driver
create table if not exists public.drivers (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nama text not null,
	nomor_hp text not null,
	status driver_status not null default 'aktif',
	created_at timestamptz not null default now()
);

-- Jadwal Delivery
create table if not exists public.delivery_schedules (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	order_id uuid not null references public.orders(id) on delete cascade,
	driver_id uuid references public.drivers(id),
	alamat text not null,
	tanggal date not null,
	slot_waktu slot_waktu not null default 'pagi',
	tipe tipe_delivery not null,
	status delivery_status not null default 'terjadwal',
	catatan text,
	latitude numeric(10,7),
	longitude numeric(10,7),
	created_at timestamptz not null default now()
);

-- Rute Delivery
create table if not exists public.delivery_routes (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	driver_id uuid not null references public.drivers(id),
	tanggal date not null,
	nama text not null,
	created_at timestamptz not null default now()
);

-- Stops dalam Rute
create table if not exists public.route_stops (
	id uuid primary key default gen_random_uuid(),
	route_id uuid not null references public.delivery_routes(id) on delete cascade,
	delivery_schedule_id uuid not null references public.delivery_schedules(id),
	urutan integer not null,
	created_at timestamptz not null default now()
);

-- Membership
create table if not exists public.members (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	customer_id uuid not null references public.customers(id) on delete cascade,
	nomor_member text not null,
	tier member_tier not null default 'regular',
	poin bigint not null default 0,
	kode_referral text unique,
	created_at timestamptz not null default now()
);

-- Riwayat Poin
create table if not exists public.points_log (
	id uuid primary key default gen_random_uuid(),
	member_id uuid not null references public.members(id) on delete cascade,
	poin bigint not null,
	tipe tipe_poin not null,
	keterangan text,
	created_at timestamptz not null default now()
);

-- Log Notifikasi WhatsApp
create table if not exists public.notifications_log (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nomor_tujuan text not null,
	template text not null,
	pesan text not null,
	status notif_status not null default 'terkirim',
	created_at timestamptz not null default now()
);

-- Pengeluaran
create table if not exists public.expenses (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	kategori kategori_pengeluaran not null default 'lain_lain',
	nominal bigint not null,
	keterangan text,
	bukti_url text,
	created_at timestamptz not null default now()
);

-- Kas Harian
create table if not exists public.daily_cash (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	tanggal date not null default current_date,
	saldo_awal bigint not null default 0,
	saldo_akhir bigint not null default 0,
	rekonsiliasi boolean not null default false,
	created_at timestamptz not null default now()
);

-- Promo
create table if not exists public.promos (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nama text not null,
	tipe tipe_promo not null default 'persen',
	nilai bigint not null,
	tier_target member_tier[],
	tanggal_mulai date not null,
	tanggal_selesai date not null,
	aktif boolean not null default true,
	created_at timestamptz not null default now()
);

-- Rekening Pembayaran per Tenant
create table if not exists public.tenant_bank_accounts (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	nama_bank text not null,
	nomor_rekening text not null,
	atas_nama text not null,
	tipe text not null default 'bank',
	aktif boolean not null default true,
	created_at timestamptz not null default now()
);

-- Konfigurasi GoWA per Tenant
create table if not exists public.tenant_gowa (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade unique,
	url_server text not null,
	nomor_hp text not null,
	api_token text not null,
	status_connected boolean not null default false,
	created_at timestamptz not null default now()
);

-- Template Pesan WA per Tenant
create table if not exists public.tenant_wa_templates (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	trigger_key text not null,
	pesan text not null,
	created_at timestamptz not null default now()
);

-- =====================================================
-- 4. INDEXES
-- =====================================================

-- Tenant lookup index
create index idx_tenants_slug on public.tenants(slug);
create index idx_tenant_users_tenant on public.tenant_users(tenant_id);
create index idx_tenant_users_user on public.tenant_users(user_id);

-- Customer search indexes
create index idx_customers_tenant on public.customers(tenant_id);
create index idx_customers_nohp on public.customers(tenant_id, nomor_hp);
create index idx_customers_nama on public.customers(tenant_id, nama);

-- Order indexes
create index idx_orders_tenant on public.orders(tenant_id);
create index idx_orders_nomor on public.orders(tenant_id, nomor_order);
create index idx_orders_status on public.orders(tenant_id, status);
create index idx_orders_created on public.orders(tenant_id, created_at desc);
create index idx_orders_customer on public.orders(customer_id);
create index idx_orders_bayar on public.orders(tenant_id, status_bayar);
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_status_log_order on public.order_status_log(order_id);

-- Payment indexes
create index idx_payments_tenant on public.payments(tenant_id);
create index idx_payments_order on public.payments(order_id);

-- Inventory indexes
create index idx_inventory_tenant on public.inventory_items(tenant_id);
create index idx_inventory_movement_item on public.inventory_movements(item_id);

-- Delivery indexes
create index idx_delivery_tenant on public.delivery_schedules(tenant_id);
create index idx_delivery_date on public.delivery_schedules(tenant_id, tanggal);
create index idx_delivery_driver on public.delivery_schedules(driver_id);
create index idx_delivery_routes_driver on public.delivery_routes(driver_id, tanggal);
create index idx_route_stops_route on public.route_stops(route_id);

-- Member indexes
create index idx_members_tenant on public.members(tenant_id);
create index idx_members_customer on public.members(customer_id);
create index idx_points_log_member on public.points_log(member_id);

-- Other indexes
create index idx_notifications_tenant on public.notifications_log(tenant_id);
create index idx_expenses_tenant on public.expenses(tenant_id);
create index idx_daily_cash_tenant on public.daily_cash(tenant_id, tanggal);
create index idx_promos_tenant on public.promos(tenant_id);

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

-- Helper: current user's tenant_id
create or replace function public.get_current_tenant_id()
returns uuid
language sql
stable
as $$
	select tenant_id from public.tenant_users where user_id = auth.uid() limit 1;
$$;

-- Helper: check if user is super admin (auth user metadata)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
	select coalesce(
		(current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'is_super_admin')::boolean,
		false
	);
$$;

-- Helper: check if user has access to a tenant
create or replace function public.user_has_tenant_access(t_tenant_id uuid)
returns boolean
language sql
stable
as $$
	select exists (
		select 1 from public.tenant_users
		where tenant_id = t_tenant_id
		and user_id = auth.uid()
		and aktif = true
	) or public.is_super_admin();
$$;

-- Enable RLS on all tenant-scoped tables
alter table public.tenants enable row level security;
alter table public.tenant_users enable row level security;
alter table public.layanan enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_log enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.drivers enable row level security;
alter table public.delivery_schedules enable row level security;
alter table public.delivery_routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.members enable row level security;
alter table public.points_log enable row level security;
alter table public.notifications_log enable row level security;
alter table public.expenses enable row level security;
alter table public.daily_cash enable row level security;
alter table public.promos enable row level security;
alter table public.tenant_bank_accounts enable row level security;
alter table public.tenant_gowa enable row level security;
alter table public.tenant_wa_templates enable row level security;

-- RLS Policies

-- TENANTS: only super admin can see all; regular users see their own
create policy "tenants_select_own"
	on public.tenants for select
	using (
		id = (select get_current_tenant_id())
		or is_super_admin()
	);

-- TENANT_USERS: users see other users in their tenant
create policy "tenant_users_select_own_tenant"
	on public.tenant_users for select
	using (
		tenant_id = (select get_current_tenant_id())
		or is_super_admin()
	);
create policy "tenant_users_insert_own_tenant"
	on public.tenant_users for insert
	with check (
		tenant_id = (select get_current_tenant_id())
		and (select role from public.tenant_users where user_id = auth.uid()) = 'admin'
		or is_super_admin()
	);
create policy "tenant_users_update_own_tenant"
	on public.tenant_users for update
	using (
		tenant_id = (select get_current_tenant_id())
		and (select role from public.tenant_users where user_id = auth.uid()) = 'admin'
		or is_super_admin()
	);

-- Dynamic RLS for tenant-scoped tables
-- Pattern: SELECT → if user has access to the tenant, they can read
-- INSERT → must be admin and user belongs to the tenant
-- UPDATE → same as insert

-- LAYANAN
create policy "layanan_select" on public.layanan for select
	using (user_has_tenant_access(tenant_id));
create policy "layanan_insert" on public.layanan for insert
	with check (user_has_tenant_access(tenant_id));
create policy "layanan_update" on public.layanan for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));
create policy "layanan_delete" on public.layanan for delete
	using (user_has_tenant_access(tenant_id));

-- CUSTOMERS
create policy "customers_select" on public.customers for select
	using (user_has_tenant_access(tenant_id));
create policy "customers_insert" on public.customers for insert
	with check (user_has_tenant_access(tenant_id));
create policy "customers_update" on public.customers for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));
create policy "customers_delete" on public.customers for delete
	using (user_has_tenant_access(tenant_id));

-- ORDERS
create policy "orders_select" on public.orders for select
	using (user_has_tenant_access(tenant_id));
create policy "orders_insert" on public.orders for insert
	with check (user_has_tenant_access(tenant_id));
create policy "orders_update" on public.orders for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));
create policy "orders_delete" on public.orders for delete
	using (user_has_tenant_access(tenant_id));

-- ORDER ITEMS (access via order)
create policy "order_items_select" on public.order_items for select
	using (exists (
		select 1 from public.orders where id = order_id and user_has_tenant_access(tenant_id)
	));
create policy "order_items_insert" on public.order_items for insert
	with check (exists (
		select 1 from public.orders where id = order_id and user_has_tenant_access(tenant_id)
	));

-- PAYMENTS
create policy "payments_select" on public.payments for select
	using (user_has_tenant_access(tenant_id));
create policy "payments_insert" on public.payments for insert
	with check (user_has_tenant_access(tenant_id));
create policy "payments_update" on public.payments for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- INVENTORY
create policy "inventory_select" on public.inventory_items for select
	using (user_has_tenant_access(tenant_id));
create policy "inventory_insert" on public.inventory_items for insert
	with check (user_has_tenant_access(tenant_id));
create policy "inventory_update" on public.inventory_items for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- DRIVERS
create policy "drivers_select" on public.drivers for select
	using (user_has_tenant_access(tenant_id));
create policy "drivers_insert" on public.drivers for insert
	with check (user_has_tenant_access(tenant_id));
create policy "drivers_update" on public.drivers for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- DELIVERY
create policy "delivery_select" on public.delivery_schedules for select
	using (user_has_tenant_access(tenant_id));
create policy "delivery_insert" on public.delivery_schedules for insert
	with check (user_has_tenant_access(tenant_id));
create policy "delivery_update" on public.delivery_schedules for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- ROUTES
create policy "routes_select" on public.delivery_routes for select
	using (user_has_tenant_access(tenant_id));
create policy "routes_insert" on public.delivery_routes for insert
	with check (user_has_tenant_access(tenant_id));
create policy "routes_delete" on public.delivery_routes for delete
	using (user_has_tenant_access(tenant_id));

-- MEMBERS
create policy "members_select" on public.members for select
	using (user_has_tenant_access(tenant_id));
create policy "members_insert" on public.members for insert
	with check (user_has_tenant_access(tenant_id));
create policy "members_update" on public.members for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- EXPENSES
create policy "expenses_select" on public.expenses for select
	using (user_has_tenant_access(tenant_id));
create policy "expenses_insert" on public.expenses for insert
	with check (user_has_tenant_access(tenant_id));
create policy "expenses_update" on public.expenses for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- DAILY CASH
create policy "daily_cash_select" on public.daily_cash for select
	using (user_has_tenant_access(tenant_id));
create policy "daily_cash_insert" on public.daily_cash for insert
	with check (user_has_tenant_access(tenant_id));
create policy "daily_cash_update" on public.daily_cash for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- PROMOS
create policy "promos_select" on public.promos for select
	using (user_has_tenant_access(tenant_id));
create policy "promos_insert" on public.promos for insert
	with check (user_has_tenant_access(tenant_id));
create policy "promos_delete" on public.promos for delete
	using (user_has_tenant_access(tenant_id));

-- TENANT BANK ACCOUNTS
create policy "bank_accounts_select" on public.tenant_bank_accounts for select
	using (user_has_tenant_access(tenant_id));
create policy "bank_accounts_insert" on public.tenant_bank_accounts for insert
	with check (user_has_tenant_access(tenant_id));
create policy "bank_accounts_update" on public.tenant_bank_accounts for update
	using (user_has_tenant_access(tenant_id))
	with check (user_has_tenant_access(tenant_id));

-- NOTIFICATIONS LOG
create policy "notifications_select" on public.notifications_log for select
	using (user_has_tenant_access(tenant_id));

-- INVENTORY MOVEMENTS
create policy "inv_movements_select" on public.inventory_movements for select
	using (exists (
		select 1 from public.inventory_items where id = item_id and user_has_tenant_access(tenant_id)
	));
create policy "inv_movements_insert" on public.inventory_movements for insert
	with check (exists (
		select 1 from public.inventory_items where id = item_id and user_has_tenant_access(tenant_id)
	));

-- POINTS LOG
create policy "points_log_select" on public.points_log for select
	using (exists (
		select 1 from public.members where id = member_id and user_has_tenant_access(tenant_id)
	));

-- ORDER STATUS LOG
create policy "order_status_log_select" on public.order_status_log for select
	using (exists (
		select 1 from public.orders where id = order_id and user_has_tenant_access(tenant_id)
	));

-- =====================================================
-- 6. TRIGGERS & AUTOMATION
-- =====================================================

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger tenants_updated_at
	before update on public.tenants
	for each row execute function public.update_updated_at();

create trigger orders_updated_at
	before update on public.orders
	for each row execute function public.update_updated_at();

-- Auto-create tenant_user record when a new auth user registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	-- Jika user mendaftar tanpa invite tenant, JANGAN auto-create tenant_users
	-- Ini akan di-handle oleh proses onboarding
	return new;
end;
$$;

-- Auto-create default layanan when a new tenant is created
create or replace function public.handle_new_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.layanan (tenant_id, nama, satuan, harga) values
		(new.id, 'Cuci Kering', 'kg', 5000),
		(new.id, 'Cuci Basah', 'kg', 5000),
		(new.id, 'Cuci, Kering, Setrika', 'kg', 7000),
		(new.id, 'Cuci Ekspres', 'kg', 9000),
		(new.id, 'Setrika Saja', 'kg', 3000);
	return new;
end;
$$;

create trigger after_tenant_created
	after insert on public.tenants
	for each row execute function public.handle_new_tenant();

-- =====================================================
-- 7. SEED DATA — Gevana Laundry (Demo Tenant)
-- =====================================================

-- Hanya dijalankan di environment development/demo
-- Jalanin: psql -f seed_demo.sql

-- insert into public.tenants (id, slug, nama, alamat, nomor_hp, paket, status)
-- values (
-- 	'00000000-0000-0000-0000-000000000001',
-- 	'gevana',
-- 	'Gevana Laundry',
-- 	'Pondok Benda, Pamulang, Tangerang Selatan',
-- 	'0812-3456-7890',
-- 	'pro',
-- 	'aktif'
-- );
