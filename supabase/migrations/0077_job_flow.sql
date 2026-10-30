-- 0077: Orders flow set by the shop (owner, 30 Oct 2026: "setting mein flow set kar sake — order received > cutting > …").
-- job_orders.status now holds the shop's own step keys (a–z, 0–9, _) besides received / ready / delivered / cancelled.
-- The steps, whose each step is, and the staff logins' rights live in owner_prefs.crm.jobSetup (no new table).
-- Safe to run more than once.
alter table public.job_orders drop constraint if exists job_orders_status_check;
alter table public.job_orders add constraint job_orders_status_check check (status ~ '^[a-z0-9_]{1,30}$');
create index if not exists job_orders_status_idx on public.job_orders (owner_id, status);
