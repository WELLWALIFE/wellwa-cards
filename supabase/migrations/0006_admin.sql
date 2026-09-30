-- Super-admin vault: the platform owner's private store for distributor
-- login credentials ("password book"). Readable/writable ONLY by the owner
-- account emails — RLS checks the JWT email, so no other logged-in user
-- (and no anonymous visitor) can ever read it.

create table if not exists public.admin_vault (
  id          smallint primary key default 1,
  credentials jsonb not null default '[]'::jsonb, -- [{name,email,password,note,ts}]
  updated_at  timestamptz not null default now(),
  constraint admin_vault_singleton check (id = 1)
);

insert into public.admin_vault (id) values (1) on conflict (id) do nothing;

alter table public.admin_vault enable row level security;

drop policy if exists admin_vault_owner on public.admin_vault;
create policy admin_vault_owner on public.admin_vault
  for all using (
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('wellwalife@gmail.com', 'licuretech@gmail.com')
  ) with check (id = 1);

grant select, update on public.admin_vault to authenticated;
