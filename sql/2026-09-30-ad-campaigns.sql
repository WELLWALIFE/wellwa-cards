-- Ads from inside the app (30 Sep 2026): our record of every Facebook / Instagram campaign the app created,
-- so the "My ads" list, Start / Pause and the history work without asking Facebook for everything each time.
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_account text not null,
  campaign_id text not null,
  adset_id text,
  ad_id text,
  creative_id text,
  name text not null,
  goal text not null default 'whatsapp',          -- whatsapp | calls | website
  creative_url text,
  creative_kind text,                              -- image | video
  primary_text text,
  headline text,
  daily_paise integer not null,
  days integer not null,
  targeting jsonb,
  status text not null default 'PAUSED',           -- PAUSED | ACTIVE (last status the app set)
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_campaigns_user_idx on public.ad_campaigns (user_id, created_at desc);
alter table public.ad_campaigns enable row level security;
drop policy if exists "own ad campaigns" on public.ad_campaigns;
create policy "own ad campaigns" on public.ad_campaigns for select using (auth.uid() = user_id);
-- The chosen ad account already lives on social_accounts.ad_account_id (added with the first Boost).
alter table public.social_accounts add column if not exists ad_account_id text;
