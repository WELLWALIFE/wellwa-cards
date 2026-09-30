-- Google Business Profile, self-service: platform OAuth client stored by the
-- super admin (no SSH), optional per-user "own OAuth client", multi-location,
-- business summary + insights cache.

-- Secrets only the server may read (service role). NOT platform_settings, which is public-read.
create table if not exists public.platform_secrets (
  id                   smallint primary key default 1 check (id = 1),
  google_client_id     text not null default '',
  google_client_secret text not null default '',
  updated_at           timestamptz not null default now()
);
insert into public.platform_secrets (id) values (1) on conflict (id) do nothing;
alter table public.platform_secrets enable row level security;
revoke all on public.platform_secrets from anon, authenticated;
grant all on public.platform_secrets to service_role;

alter table public.google_accounts add column if not exists client_id text not null default '';      -- user's own OAuth client (optional)
alter table public.google_accounts add column if not exists client_secret text not null default '';
alter table public.google_accounts add column if not exists locations jsonb not null default '[]'::jsonb; -- [{name,title,address,phone,maps}]
alter table public.google_accounts add column if not exists address text not null default '';
alter table public.google_accounts add column if not exists phone text not null default '';
alter table public.google_accounts add column if not exists maps_url text not null default '';
alter table public.google_accounts add column if not exists rating numeric;
alter table public.google_accounts add column if not exists review_count int not null default 0;
alter table public.google_accounts add column if not exists insights jsonb not null default '{}'::jsonb;
alter table public.google_accounts add column if not exists insights_at timestamptz;
alter table public.google_accounts add column if not exists last_error text not null default '';
grant all on public.google_accounts to service_role;
