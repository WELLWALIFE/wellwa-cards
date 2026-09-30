-- ============================================================
-- Wellwa Cards — initial schema (Phase 2)
-- Run in Supabase → SQL Editor, or via the Supabase CLI.
-- Multi-tenant with Row Level Security so each user sees only
-- their own data. Public card pages are readable by anyone.
-- ============================================================

-- ---------- Profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  business    text,
  plan        text not null default 'free' check (plan in ('free','pro','team')),
  created_at  timestamptz not null default now()
);

-- ---------- Cards ----------
create table if not exists public.cards (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  username     text not null unique,               -- public slug: /c/<username>
  name         text not null default '',
  job_title    text default '',
  company      text default '',
  tagline      text default '',
  about        text default '',
  theme_color  text default '#0d8f86',
  avatar_url   text,
  cover_url    text,
  active       bool not null default true,
  views        int  not null default 0,
  created_at   timestamptz not null default now(),
  -- Full card document (pages, blocks, links, template…) as edited in the app.
  data         jsonb not null default '{}'::jsonb
);
create index if not exists cards_owner_idx on public.cards(owner_id);
-- Idempotent for projects that ran an earlier version of this file:
alter table public.cards add column if not exists data jsonb not null default '{}'::jsonb;

-- ---------- Card links / buttons ----------
create table if not exists public.card_links (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references public.cards(id) on delete cascade,
  type      text not null,                          -- phone|email|whatsapp|website|...
  label     text not null,
  value     text not null,
  position  int  not null default 0
);
create index if not exists card_links_card_idx on public.card_links(card_id);

-- ---------- Card sections (about, gallery, services, pdf, video) ----------
create table if not exists public.card_sections (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references public.cards(id) on delete cascade,
  kind      text not null,
  title     text not null default '',
  body      text default '',
  position  int  not null default 0
);
create index if not exists card_sections_card_idx on public.card_sections(card_id);

-- ---------- Leads ----------
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text default '',
  phone      text default '',
  email      text default '',
  message    text default '',
  source     text not null default 'form',          -- form|whatsapp|vcard|qr
  status     text not null default 'new',            -- new|hot|warm|cold|won
  score      int  not null default 0,                -- AI lead score 0-100
  created_at timestamptz not null default now()
);
create index if not exists leads_owner_idx on public.leads(owner_id);
create index if not exists leads_card_idx  on public.leads(card_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.cards         enable row level security;
alter table public.card_links    enable row level security;
alter table public.card_sections enable row level security;
alter table public.leads         enable row level security;

-- Profiles: a user manages only their own row.
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Cards: owner has full control.
create policy "owner manages cards" on public.cards
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Cards: anyone can READ an active card (public card page).
create policy "public reads active cards" on public.cards
  for select using (active = true);

-- Card links/sections: readable with the card; writable by owner.
create policy "read links" on public.card_links for select using (true);
create policy "owner writes links" on public.card_links
  for all using (exists (select 1 from public.cards c where c.id = card_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.cards c where c.id = card_id and c.owner_id = auth.uid()));

create policy "read sections" on public.card_sections for select using (true);
create policy "owner writes sections" on public.card_sections
  for all using (exists (select 1 from public.cards c where c.id = card_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.cards c where c.id = card_id and c.owner_id = auth.uid()));

-- Leads: owner reads/manages; anyone can INSERT (a visitor submitting a form).
create policy "owner reads leads" on public.leads
  for select using (auth.uid() = owner_id);
create policy "owner updates leads" on public.leads
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "anyone submits lead" on public.leads
  for insert with check (true);

-- ---------- Auto-create a profile row on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Public view counter (anon-safe, security definer) ----------
create or replace function public.increment_card_views(p_username text)
returns void language sql security definer set search_path = public as $$
  update public.cards set views = views + 1
  where username = p_username and active = true;
$$;
grant execute on function public.increment_card_views(text) to anon, authenticated;

-- ---------- Storage: media bucket for card photos & PDFs ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public reads media" on storage.objects;
create policy "public reads media" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "auth uploads media" on storage.objects;
create policy "auth uploads media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "auth updates own media" on storage.objects;
create policy "auth updates own media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and owner = auth.uid())
  with check (bucket_id = 'media' and owner = auth.uid());

drop policy if exists "auth deletes own media" on storage.objects;
create policy "auth deletes own media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and owner = auth.uid());
