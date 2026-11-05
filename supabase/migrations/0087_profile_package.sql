-- The package an account is on (owner, 5 Nov 2026): Website Standard / Website Premium (a year) or Custom Solutions, set by Super Admin
-- (or a franchise allowed to activate plans) when the payment was taken by hand or is agreed for later. Website + V-Card stay live for
-- the year; the Growth features (posters, WhatsApp AI, CRM…) run on profiles.plan / plan_expires_at — one month free with every package.
alter table public.profiles add column if not exists package text not null default ''
  check (package in ('', 'site_standard', 'site_premium', 'custom'));
alter table public.profiles add column if not exists package_until timestamptz;
alter table public.profiles add column if not exists package_note text not null default '';
comment on column public.profiles.package is 'site_standard | site_premium | custom | '''' — the paid package, set by admin; package_until = end of its year';
