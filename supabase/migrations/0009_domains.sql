-- Custom domains: card.yourbusiness.com → a specific card.
--
-- Kept in its own table rather than a column on cards so the request-time
-- lookup is a single primary-key hit: middleware runs on every request to an
-- unknown host, so it has to be cheap.

create table if not exists public.card_domains (
  domain      text primary key,                    -- lowercase hostname, no scheme/port
  card_id     uuid not null references public.cards(id)    on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  username    text not null,                       -- denormalised: saves a join per request
  verified    bool not null default false,         -- DNS points here AND a certificate exists
  last_error  text,                                -- why the last verify attempt failed
  created_at  timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists card_domains_card_idx  on public.card_domains(card_id);
create index if not exists card_domains_owner_idx on public.card_domains(owner_id);

alter table public.card_domains enable row level security;

-- Owners manage their own domains.
drop policy if exists "owner manages domains" on public.card_domains;
create policy "owner manages domains" on public.card_domains
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Anyone may resolve a verified domain — this is what serves the public card.
drop policy if exists "public resolves verified domains" on public.card_domains;
create policy "public resolves verified domains" on public.card_domains
  for select using (verified = true);

grant select on public.card_domains to anon, authenticated;
grant insert, update, delete on public.card_domains to authenticated;

-- Is this domain free to claim? Mirrors username_available: a plain select can
-- only see verified rows, so an unverified claim by someone else would look
-- free and then collide on the primary key.
create or replace function public.domain_available(p_domain text, p_card_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.card_domains
    where domain = lower(trim(p_domain))
      and (p_card_id is null or card_id <> p_card_id)
  );
$$;

revoke all on function public.domain_available(text, uuid) from public;
grant execute on function public.domain_available(text, uuid) to anon, authenticated;
