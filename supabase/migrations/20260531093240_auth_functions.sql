-- =====================================================
-- Auth Functions — multi-tenant registration
-- =====================================================

-- Helper: cek slug sudah dipakai atau belum
create or replace function public.slug_exists(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (select 1 from public.tenants where slug = p_slug);
$$;

-- Helper: cek email sudah dipakai atau belum (di tenant mana pun)
create or replace function public.email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (select 1 from auth.users where email = p_email);
$$;

-- SECURITY DEFINER: create tenant + link user as admin
-- Fungsi ini bypass RLS karena dijalankan dengan hak akses pemilik fungsi
create or replace function public.create_tenant_and_user(
	p_nama_toko text,
	p_slug text,
	p_nama_pemilik text,
	p_email text,
	p_nomor_hp text,
	p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_tenant jsonb;
begin
	-- Cek slug unik
	if public.slug_exists(p_slug) then
		raise exception 'Slug "%" sudah digunakan', p_slug using errcode = '23505';
	end if;

	-- Cek apakah user_id valid di auth.users
	if not exists (select 1 from auth.users where id = p_user_id) then
		raise exception 'User tidak ditemukan di sistem' using errcode = 'P0002';
	end if;

	-- Buat tenant
	insert into public.tenants (slug, nama, nomor_hp, email, paket, status)
	values (p_slug, p_nama_toko, p_nomor_hp, p_email, 'free', 'aktif')
	returning row_to_json(tenants.*)::jsonb into v_tenant;

	v_tenant_id := (v_tenant->>'id')::uuid;

	-- Link user sebagai admin tenant
	insert into public.tenant_users (tenant_id, email, nama, role, user_id, aktif)
	values (v_tenant_id, p_email, p_nama_pemilik, 'admin', p_user_id, true);

	-- Layanan default akan auto-insert oleh trigger after_tenant_created

	return jsonb_build_object(
		'tenant_id', v_tenant_id,
		'slug', p_slug,
		'nama', p_nama_toko
	);
end;
$$;

-- Helper: ambil tenant info buat user yang login
-- Dipanggil setelah login untuk redirect ke workspace
create or replace function public.get_user_default_tenant(p_user_id uuid default auth.uid())
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'tenant_id', tu.tenant_id,
		'slug', t.slug,
		'nama_toko', t.nama,
		'nama_user', tu.nama,
		'role', tu.role,
		'paket', t.paket
	)
	from public.tenant_users tu
	join public.tenants t on t.id = tu.tenant_id
	where tu.user_id = p_user_id
	and tu.aktif = true
	and t.status = 'aktif'
	limit 1;
$$;
