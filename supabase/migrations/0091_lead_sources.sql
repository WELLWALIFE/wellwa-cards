-- CRM → Lead sources (owner, 20 Nov 2026: "Google Form, IndiaMART ya jo bhi other lead platform hai, wo add karne ka option, aur kisi
-- bhi website se connect"). IndiaMART's Lead Manager Pull API needs the seller's own key; the server pulls every 15 minutes
-- (scripts/lead-pull.sh → /api/cron/lead-pull) and keeps the enquiry ids it has already taken, so nothing comes in twice.
alter table public.crm_integrations add column if not exists indiamart_key  text not null default '';
alter table public.crm_integrations add column if not exists indiamart_seen text[] not null default '{}';
alter table public.crm_integrations add column if not exists indiamart_at   timestamptz;
alter table public.crm_integrations add column if not exists indiamart_note text not null default '';
