-- 0067 — AI phone receptionist (phase 3, owner's call 8 Oct 2026).
-- phone_lines: the virtual number (Exotel / Twilio) Shubhora assigns to an owner; calls to it stream to
-- bridge/phone-worker.mjs, which answers with the owner's AI (the same knowledge as the WhatsApp and website
-- assistant). phone_calls: what happened on each call — transcript, summary, intent — shown on the owner's Phone tab;
-- the caller becomes a lead and a booking when they asked for one.
create table if not exists public.phone_lines (
  number      text primary key,                                 -- E.164 digits, "919876543210"
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  provider    text not null default 'exotel',                   -- exotel | twilio
  label       text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists phone_lines_owner_idx on public.phone_lines (owner_id);
create table if not exists public.phone_calls (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  line        text not null default '',
  caller      text not null default '',
  started_at  timestamptz not null default now(),
  seconds     int not null default 0,
  transcript  jsonb not null default '[]'::jsonb,               -- [{role:"caller"|"ai", text}]
  summary     text not null default '',
  intent      text not null default '',                        -- enquiry | order | booking | callback | other
  lead_id     uuid references public.leads(id) on delete set null,
  booking_id  uuid references public.bookings(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists phone_calls_owner_idx on public.phone_calls (owner_id, started_at desc);
alter table public.phone_lines enable row level security;
alter table public.phone_calls enable row level security;
drop policy if exists "owner reads phone lines" on public.phone_lines;
create policy "owner reads phone lines" on public.phone_lines for select using (auth.uid() = owner_id);
drop policy if exists "owner reads phone calls" on public.phone_calls;
create policy "owner reads phone calls" on public.phone_calls for select using (auth.uid() = owner_id);
