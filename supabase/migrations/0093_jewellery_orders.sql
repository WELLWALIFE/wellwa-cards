-- 0093: Shubhora Jewellery, phase 2 (owner, 23 Nov 2026 — plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK): customer orders
-- and repairs (booking, advance, booking-rate lock, karigar, ready, delivered → bill) and the karigar's fine-gold ledger (gold given,
-- work received, wastage allowed, labour and payments). Same units and rules as 0092: paise, milligrams, basis points; service role
-- only (RLS on, nothing granted to anon / authenticated). Safe to run more than once.

create table if not exists public.jw_karigars (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  phone       text not null default '',
  skill       text not null default '',                    -- e.g. "Bengali work", "Casting", "Polish"
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists jw_karigars_owner_idx on public.jw_karigars (owner_id, active);

create table if not exists public.jw_orders (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  kind             text not null check (kind in ('order','repair')),
  number           integer not null,
  fin_year         text not null,
  code             text not null,                          -- "ORD/2026-27/4", "REP/2026-27/9"
  status           text not null default 'booked' check (status in ('booked','karigar','ready','delivered','cancelled')),
  customer_name    text not null default '',
  customer_phone   text not null default '',
  items            jsonb not null default '[]'::jsonb,     -- OrderItem[]
  est_paise        bigint not null default 0,              -- the estimate given (order) or the repair charge
  payments         jsonb not null default '[]'::jsonb,     -- advances, Payment[]
  rate_lock        jsonb,                                  -- { purity, rate (paise/g), day } when the booking rate is locked
  due_date         date,
  karigar_id       uuid references public.jw_karigars(id) on delete set null,
  notes            text not null default '',
  events           jsonb not null default '[]'::jsonb,     -- the timeline: [{ at, by, text }]
  bill_id          uuid references public.jw_bills(id) on delete set null,
  token            text not null default replace(gen_random_uuid()::text, '-', ''),  -- the customer's receipt /jo/<id>?t=<token>
  created_by       uuid references public.profiles(id) on delete set null,
  created_by_name  text not null default '',
  cancel_reason    text not null default '',
  delivered_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, kind, fin_year, number)
);
create index if not exists jw_orders_owner_idx on public.jw_orders (owner_id, status, due_date);
create index if not exists jw_orders_phone_idx on public.jw_orders (owner_id, customer_phone);

create table if not exists public.jw_karigar_txns (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  karigar_id      uuid not null references public.jw_karigars(id) on delete cascade,
  order_id        uuid references public.jw_orders(id) on delete set null,
  kind            text not null check (kind in ('issue','receive','labour','payment')),
  metal           text not null default 'gold' check (metal in ('gold','silver','platinum')),
  gross_mg        bigint not null default 0,
  touch_bp        integer not null default 0,               -- purity of what moved, 9160 = 91.6%
  fine_mg         bigint not null default 0,                -- worked out by the server: gross × touch
  wastage_mg      bigint not null default 0,                -- fine wastage allowed on a receive
  paise           bigint not null default 0,                -- labour earned / money paid
  note            text not null default '',
  day             date not null default (now() at time zone 'Asia/Kolkata')::date,
  voided          boolean not null default false,           -- a wrong entry is voided, never deleted
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists jw_karigar_txns_idx on public.jw_karigar_txns (owner_id, karigar_id, created_at desc);

alter table public.jw_bills add column if not exists order_id uuid references public.jw_orders(id) on delete set null;

alter table public.jw_karigars enable row level security;
alter table public.jw_orders enable row level security;
alter table public.jw_karigar_txns enable row level security;
revoke all on public.jw_karigars, public.jw_orders, public.jw_karigar_txns from anon, authenticated;
