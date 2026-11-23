-- 0095: Shubhora Jewellery, phase 5 (owner, 23 Nov 2026): the gold saving scheme and girvi (gold loan). Both stay OFF until the
-- shop switches them on in Jewellery → Settings after the legal note (girvi also needs its money-lender licence typed).
-- Same rules as 0092–0094: paise, milligrams, basis points; service role only (RLS on, nothing granted to anon / authenticated).
-- Safe to run more than once.

create table if not exists public.jw_schemes (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  number           integer not null,
  fin_year         text not null,
  code             text not null,                          -- "GS/2026-27/1"
  status           text not null default 'active' check (status in ('active','redeemed','closed')),
  plan             jsonb not null,                         -- the plan as it was when joined: {key,name,months,monthlyPaise,bonusPaise}
  customer_name    text not null default '',
  customer_phone   text not null default '',
  customer_address text not null default '',
  nominee          text not null default '',
  start_day        date not null,
  payments         jsonb not null default '[]'::jsonb,     -- instalments: [{mode,paise,ref,at}]
  bill_id          uuid references public.jw_bills(id) on delete set null,   -- the bill it was used on
  close_note       text not null default '',
  token            text not null default replace(gen_random_uuid()::text, '-', ''),  -- the member's passbook /js/<id>?t=<token>
  created_by       uuid references public.profiles(id) on delete set null,
  created_by_name  text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, fin_year, number)
);
create index if not exists jw_schemes_owner_idx on public.jw_schemes (owner_id, status);
create index if not exists jw_schemes_phone_idx on public.jw_schemes (owner_id, customer_phone);

create table if not exists public.jw_girvi (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  number           integer not null,
  fin_year         text not null,
  code             text not null,                          -- "GV/2026-27/1"
  status           text not null default 'open' check (status in ('open','closed','auctioned')),
  customer_name    text not null default '',
  customer_phone   text not null default '',
  customer_address text not null default '',
  id_proof         text not null default '',               -- type and last 4 digits only, e.g. "Aadhaar xx1234"
  items            jsonb not null default '[]'::jsonb,     -- [{desc,metal,grossMg,netMg,touchBp,fineMg,pieces}]
  valuation_paise  bigint not null default 0,
  loan_paise       bigint not null default 0,
  rate_bp          integer not null default 0,             -- interest a month, 150 = 1.5%
  min_days         integer not null default 0,
  start_day        date not null,
  due_day          date not null,
  payments         jsonb not null default '[]'::jsonb,     -- [{mode,paise,ref,at,interest,principal}]
  notices          jsonb not null default '[]'::jsonb,     -- reminders / notices sent: [{day,by}]
  close_note       text not null default '',
  closed_at        timestamptz,
  token            text not null default replace(gen_random_uuid()::text, '-', ''),  -- the customer's receipt /jg/<id>?t=<token>
  created_by       uuid references public.profiles(id) on delete set null,
  created_by_name  text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, fin_year, number)
);
create index if not exists jw_girvi_owner_idx on public.jw_girvi (owner_id, status, due_day);
create index if not exists jw_girvi_phone_idx on public.jw_girvi (owner_id, customer_phone);

alter table public.jw_bills add column if not exists scheme_id uuid references public.jw_schemes(id) on delete set null;

alter table public.jw_schemes enable row level security;
alter table public.jw_girvi enable row level security;
revoke all on public.jw_schemes, public.jw_girvi from anon, authenticated;
