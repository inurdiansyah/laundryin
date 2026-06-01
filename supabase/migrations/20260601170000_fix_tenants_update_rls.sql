-- Fix: allow tenants to update their own profile (nama, alamat, nomor_hp, etc.)
create policy "tenants_update_own"
  on public.tenants for update
  using (id = (select get_current_tenant_id()))
  with check (id = (select get_current_tenant_id()));
