-- Monthly content calendar: what each profile posts on each day.
create table if not exists public.poster_calendar (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  profile_id  uuid not null references public.poster_profiles(id) on delete cascade,
  for_date    date not null,
  kind        text not null default 'auto' check (kind in ('auto','festival','product','offer','greeting','skip')),
  product_id  uuid references public.poster_products(id) on delete set null,
  note        text default '',
  status      text not null default 'planned' check (status in ('planned','done','skipped')),
  created_at  timestamptz not null default now(),
  unique (profile_id, for_date)
);
create index if not exists poster_calendar_profile_idx on public.poster_calendar(profile_id, for_date);
alter table public.poster_calendar enable row level security;
drop policy if exists "own poster calendar" on public.poster_calendar;
create policy "own poster calendar" on public.poster_calendar for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.poster_calendar to authenticated, service_role;
select 'poster calendar ready' as status;
