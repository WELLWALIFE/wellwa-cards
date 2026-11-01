-- 0081 — The franchise applicant sets their own panel password in the website form (owner, 1 Nov 2026: "password form me hi dal do,
-- generate wala option hata do"). Only a bcrypt hash is kept; on approval the login is created from it (GoTrue admin `password_hash`).
-- Safe to run more than once.
alter table public.franchise_applications add column if not exists password_hash text not null default '';
alter table public.franchise_applications add column if not exists has_account  boolean not null default false;   -- the mobile already has a Shubhora login: that password stays
select 'ok' as status;
