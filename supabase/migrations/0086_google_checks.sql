-- Google Health Check (owner, 4 Nov 2026): every finished report, kept so the same business is served from here for 7 days
-- (a report costs Places + DataForSEO money) and so the admin sees who asked and which leads left a phone number.
create table if not exists public.google_checks (
  id bigint generated always as identity primary key,
  place_id text not null,
  name text not null default '',
  city text not null default '',
  query text not null default '',
  score int not null default 0,
  report jsonb not null,
  ip text not null default '',
  user_id uuid references auth.users(id) on delete set null,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists google_checks_place_idx on public.google_checks (place_id, created_at desc);
create index if not exists google_checks_created_idx on public.google_checks (created_at desc);
alter table public.google_checks enable row level security;
-- Service role only (the API writes and reads with the admin client); nobody else sees other people's checks.
