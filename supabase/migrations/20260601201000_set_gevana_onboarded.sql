-- Set demo Gevana tenant as onboarding completed
update public.tenants
set onboarding_completed = true
where slug = 'gevana';
