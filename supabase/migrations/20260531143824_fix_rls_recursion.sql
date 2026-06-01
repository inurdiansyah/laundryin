-- Fix recursive RLS yang menyebabkan stack overflow
-- Masalah: get_current_tenant_id() baca tenant_users → RLS tenant_users
--          panggil get_current_tenant_id() lagi → infinite loop

-- 1. Buat get_current_tenant_id jadi SECURITY DEFINER supaya bypass RLS tenant_users
create or replace function public.get_current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id from public.tenant_users where user_id = auth.uid() limit 1;
$$;

-- 2. Buat user_has_tenant_access jadi SECURITY DEFINER juga (biar aman)
create or replace function public.user_has_tenant_access(t_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_users
    where tenant_id = t_tenant_id
    and user_id = auth.uid()
    and aktif = true
  ) or public.is_super_admin();
$$;

-- 3. Pastikan is_super_admin juga SECURITY DEFINER (baca JWT, aman)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;
