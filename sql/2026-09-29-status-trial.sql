-- WhatsApp Status free for 14 days (owner's call, 29 Sep 2026): a free account that links WhatsApp and switches the
-- daily Status on gets the AI status (Signature poster + voice video) for 14 days. The end date lives here; the app
-- sets it when the switch is turned on, the 4 AM post sets it on the first morning otherwise. Safe to run twice.
alter table public.profiles add column if not exists status_trial_until timestamptz;
comment on column public.profiles.status_trial_until is 'Free plan: WhatsApp Status auto-post allowed until this moment (14-day trial). NULL = not started.';
grant select, update (status_trial_until) on public.profiles to service_role;

-- Check: the column exists (1 row).
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'status_trial_until';
