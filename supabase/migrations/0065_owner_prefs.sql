-- 0065 — Owner preferences for customer messaging (owner's call, 8 Oct 2026, phase 2).
-- festival_wishes: on the morning of a festival (src/lib/festivals.ts) every customer in the CRM with a number hears from
-- the business by name, over the owner's linked WhatsApp. review_ask: a thank-you with the Google review link when a
-- booking is marked done or a lead converted. Both default on for review asks (they go only to people who bought) and
-- off for festival wishes (the owner switches them on, on the CRM tab).
create table if not exists public.owner_prefs (
  owner_id        uuid primary key references public.profiles(id) on delete cascade,
  festival_wishes boolean not null default false,
  review_ask      boolean not null default true,
  updated_at      timestamptz not null default now()
);
alter table public.owner_prefs enable row level security;
drop policy if exists "owner manages prefs" on public.owner_prefs;
create policy "owner manages prefs" on public.owner_prefs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
