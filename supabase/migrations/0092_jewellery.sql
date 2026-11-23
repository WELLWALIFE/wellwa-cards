-- 0092: Shubhora Jewellery, phase 1 (owner, 23 Nov 2026 — plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK): today's rate,
-- estimates and GST bills with old-gold exchange and payments. Generic for every jeweller; the shop's settings (purities, making,
-- GST, staff rights) live in owner_prefs.crm.jewelSetup like the tailor Orders setup (no table).
--
-- Money in paise, weights in milligrams, rates in paise per gram (see src/lib/jewellery.ts). Read and written only through the
-- app's API with the service role (the API checks owner / team role), so RLS is on and nothing is granted to anon or
-- authenticated. Safe to run more than once.

create table if not exists public.jw_rates (
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  day         date not null,                               -- India date the rate is for
  sell        jsonb not null default '{}'::jsonb,          -- { "g24": 720000, "g22": 660180, "s999": 9000 } paise per gram
  buy         jsonb not null default '{}'::jsonb,          -- old-metal buy rates, same keys (optional)
  set_by      uuid references public.profiles(id) on delete set null,
  set_by_name text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (owner_id, day)
);

create table if not exists public.jw_bills (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  kind             text not null check (kind in ('sale','estimate')),
  number           integer not null,                       -- running number per kind and financial year
  fin_year         text not null,                          -- "2026-27"
  code             text not null,                          -- printed number, e.g. "INV/2026-27/12"
  status           text not null default 'open' check (status in ('open','paid','cancelled','converted')),
  customer_name    text not null default '',
  customer_phone   text not null default '',               -- +91XXXXXXXXXX
  customer_pan     text not null default '',
  customer_gstin   text not null default '',
  customer_state   text not null default '',               -- GST state code, "" = the shop's own state
  customer_address text not null default '',
  lines            jsonb not null default '[]'::jsonb,     -- BillLine[]
  old_gold         jsonb not null default '[]'::jsonb,     -- OldGoldLine[]
  payments         jsonb not null default '[]'::jsonb,     -- Payment[]
  discount_paise   bigint not null default 0,
  discount_on      text not null default 'making' check (discount_on in ('making','total')),
  advance_paise    bigint not null default 0,
  total_paise      bigint not null default 0,              -- worked out by the server from the lines (never trusted from the app)
  gst_paise        bigint not null default 0,
  balance_paise    bigint not null default 0,              -- total − old gold − advance − payments (negative: the shop pays back)
  rate_day         date,
  notes            text not null default '',
  due_date         date,                                   -- when the balance is due (udhaar)
  valid_till       date,                                   -- an estimate's validity
  from_estimate    uuid references public.jw_bills(id) on delete set null,
  token            text not null default replace(gen_random_uuid()::text, '-', ''),  -- the customer's link /jb/<id>?t=<token>
  created_by       uuid references public.profiles(id) on delete set null,
  created_by_name  text not null default '',
  cancel_reason    text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, kind, fin_year, number)
);
create index if not exists jw_bills_owner_idx on public.jw_bills (owner_id, kind, created_at desc);
create index if not exists jw_bills_phone_idx on public.jw_bills (owner_id, customer_phone);
create index if not exists jw_bills_due_idx on public.jw_bills (owner_id, balance_paise) where status = 'open';

alter table public.jw_rates enable row level security;
alter table public.jw_bills enable row level security;
revoke all on public.jw_rates, public.jw_bills from anon, authenticated;
