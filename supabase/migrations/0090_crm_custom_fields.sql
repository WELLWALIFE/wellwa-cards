-- CRM: the business's own fields on a customer (owner, 18 Nov 2026).
-- The field definitions are in owner_prefs.crm.fields; the values of one customer live here, keyed by the field's key.
-- Safe to run more than once. Until it is run the CRM works as before; the custom fields say "not switched on yet".
alter table public.leads add column if not exists extra jsonb not null default '{}'::jsonb;
