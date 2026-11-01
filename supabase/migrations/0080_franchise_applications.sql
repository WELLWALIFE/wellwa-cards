-- 0080 — "Become a franchise" (owner, 1 Nov 2026: "site per become a franchise ka option, form fill karao, admin approve kare tab start").
-- Safe to run more than once.
--
--   franchise_applications  one application from the website form (shubhora.com/franchise). Super Admin reviews it: contacted →
--                           approved (a franchise row + its login are made from it, franchise_id points at it) or rejected.
-- Service-role only: the public form writes through the app's API (rate-limited, honeypot), the admin panel reads it.

create table if not exists public.franchise_applications (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                           -- the person
  phone         text not null,                           -- +91XXXXXXXXXX
  email         text not null default '',
  company       text not null default '',
  city          text not null default '',
  state         text not null default '',
  area          text not null default '',                -- the territory they want, in words
  background    text not null default '',                -- what they do today / why them
  reach         text not null default '',                -- how many businesses they can reach, their network
  source        text not null default 'website',
  status        text not null default 'new' check (status in ('new','contacted','approved','rejected')),
  note          text not null default '',                -- admin's notes
  franchise_id  uuid references public.franchises(id) on delete set null,
  decided_by    uuid,
  decided_at    timestamptz,
  ip            text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists franchise_applications_status_idx on public.franchise_applications (status, created_at desc);
create index if not exists franchise_applications_phone_idx  on public.franchise_applications (phone);

alter table public.franchise_applications enable row level security;
revoke all on public.franchise_applications from anon, authenticated;
grant all on public.franchise_applications to service_role;

select 'ok' as status;
