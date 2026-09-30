-- Month planning: per-day overrides (style, voice, music, custom line) and
-- user-entered offers (never invented) scoped to all products or chosen ones.
alter table public.poster_calendar add column if not exists overrides jsonb not null default '{}'::jsonb; -- {style, voice:"on"|"off", music, custom}

create table if not exists public.poster_offers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  text        text not null,                        -- exactly what the user typed, e.g. "Diwali offer: 20% off"
  starts      date not null,
  ends        date not null,
  scope       text not null default 'all' check (scope in ('all','products')),
  product_ids uuid[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists poster_offers_user_idx on public.poster_offers(user_id, starts, ends);
alter table public.poster_offers enable row level security;
drop policy if exists "owner all poster_offers" on public.poster_offers;
create policy "owner all poster_offers" on public.poster_offers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.poster_offers to authenticated;
grant all on public.poster_offers to service_role;
grant all on public.poster_calendar to service_role;
