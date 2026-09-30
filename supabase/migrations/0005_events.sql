-- Card engagement events: views (with traffic source) + button clicks.
-- Powers per-card analytics: which buttons get clicked, which platform sends leads.

create table if not exists public.card_events (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,                 -- card slug (no FK — cheap, survives re-publish)
  kind       text not null,                 -- view | click
  target     text not null default '',      -- whatsapp | call | email | website | vcard | product | share | chat …
  src        text not null default '',      -- traffic source from ?src= (insta | fb | status | copy | qr …)
  created_at timestamptz not null default now()
);

create index if not exists card_events_username_idx on public.card_events (username, created_at desc);

alter table public.card_events enable row level security;

-- Anyone (visitors) can record events; only the card's owner can read them.
drop policy if exists card_events_insert on public.card_events;
create policy card_events_insert on public.card_events
  for insert with check (true);

drop policy if exists card_events_select on public.card_events;
create policy card_events_select on public.card_events
  for select using (
    exists (
      select 1 from public.cards c
      where c.username = card_events.username and c.owner_id = auth.uid()
    )
  );

grant insert on public.card_events to anon, authenticated;
grant select on public.card_events to authenticated;
