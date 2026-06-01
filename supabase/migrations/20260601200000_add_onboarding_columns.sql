-- Add onboarding and payment config columns to tenants
alter table public.tenants
    add column if not exists onboarding_completed boolean not null default false,
    add column if not exists rekening jsonb default '{}'::jsonb,
    add column if not exists gowa_config jsonb default '{}'::jsonb;
