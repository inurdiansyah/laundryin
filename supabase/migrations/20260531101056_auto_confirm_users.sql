-- =====================================================
-- Auto-confirm users for development
-- =====================================================

-- 1. Confirm user admin@gevana.com yang sudah terdaftar
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'admin@gevana.com';

-- 2. Auto-confirm semua user yang belum confirm (mencegah issue serupa)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null
  and created_at > now() - interval '72 hours';

-- 3. Trigger: auto-confirm user baru saat signup
create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id
    and email_confirmed_at is null;
  return new;
end;
$$;

-- Trigger hanya dibuat jika belum ada
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created_auto_confirm'
  ) then
    create trigger on_auth_user_created_auto_confirm
      after insert on auth.users
      for each row
      execute function public.auto_confirm_new_user();
  end if;
end;
$$;
