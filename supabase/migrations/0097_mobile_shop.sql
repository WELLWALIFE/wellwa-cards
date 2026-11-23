-- 0097: Shubhora Mobile Shop, phase 1 (owner, 23 Nov 2026 — plan https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd): items
-- (accessories and parts counted, phones one row per IMEI), purchases, bills and estimates with payments. The shop's settings live in
-- owner_prefs.crm.mobileSetup. Money in paise, GST in basis points. Read and written only through the app's API with the service
-- role, so RLS is on and nothing is granted to anon or authenticated. Safe to run more than once.

create table if not exists public.ms_items (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  kind            text not null default 'accessory' check (kind in ('accessory','phone','part','service')),
  name            text not null default '',
  brand           text not null default '',
  model           text not null default '',
  variant         text not null default '',               -- colour, RAM/ROM, length…
  category        text not null default 'other',
  hsn             text not null default '',
  gst_bp          integer not null default 1800,
  price_paise     bigint not null default 0,              -- selling price of one, tax included
  mrp_paise       bigint not null default 0,
  cost_paise      bigint not null default 0,              -- last purchase cost of one
  barcode         text not null default '',
  qty             integer not null default 0,             -- counted stock (not used for serial items)
  low_qty         integer not null default 0,
  fits            text[] not null default '{}',           -- phone models an accessory fits
  serial          boolean not null default false,         -- true: sold by IMEI / serial (ms_units)
  warranty_months integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ms_items_owner_idx on public.ms_items (owner_id, active, kind);
create unique index if not exists ms_items_barcode_idx on public.ms_items (owner_id, barcode) where barcode <> '';

create table if not exists public.ms_purchases (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  supplier_name   text not null default '',
  supplier_phone  text not null default '',
  supplier_gstin  text not null default '',
  bill_no         text not null default '',
  bill_date       date,
  lines           jsonb not null default '[]'::jsonb,     -- [{itemId,name,qty,cost,imeis}]
  total_paise     bigint not null default 0,
  paid_paise      bigint not null default 0,
  notes           text not null default '',
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists ms_purchases_owner_idx on public.ms_purchases (owner_id, created_at desc);

create table if not exists public.ms_bills (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('sale','estimate')),
  number          integer not null,
  fin_year        text not null,
  code            text not null,
  status          text not null default 'open' check (status in ('open','paid','cancelled','converted')),
  customer_name   text not null default '',
  customer_phone  text not null default '',
  customer_gstin  text not null default '',
  customer_state  text not null default '',
  lines           jsonb not null default '[]'::jsonb,     -- BillLine[]
  payments        jsonb not null default '[]'::jsonb,
  discount_paise  bigint not null default 0,
  total_paise     bigint not null default 0,              -- worked out by the server
  gst_paise       bigint not null default 0,
  balance_paise   bigint not null default 0,
  profit_paise    bigint not null default 0,
  gst_on          boolean not null default false,         -- was GST charged when it was made
  notes           text not null default '',
  due_date        date,
  token           text not null default replace(gen_random_uuid()::text, '-', ''),  -- the customer's link /mb/<id>?t=<token>
  client_id       text,                                   -- set by a bill made offline: the same bill is never saved twice
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  cancel_reason   text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, kind, fin_year, number)
);
create index if not exists ms_bills_owner_idx on public.ms_bills (owner_id, kind, created_at desc);
create index if not exists ms_bills_phone_idx on public.ms_bills (owner_id, customer_phone);
create unique index if not exists ms_bills_client_idx on public.ms_bills (owner_id, client_id) where client_id is not null;

create table if not exists public.ms_units (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  item_id     uuid not null references public.ms_items(id) on delete cascade,
  imei1       text not null,
  imei2       text not null default '',
  serial_no   text not null default '',
  status      text not null default 'in_stock' check (status in ('in_stock','sold','returned','demo')),
  cost_paise  bigint not null default 0,
  purchase_id uuid references public.ms_purchases(id) on delete set null,
  bill_id     uuid references public.ms_bills(id) on delete set null,
  sold_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (owner_id, imei1)
);
create index if not exists ms_units_item_idx on public.ms_units (owner_id, item_id, status);
create index if not exists ms_units_bill_idx on public.ms_units (bill_id) where bill_id is not null;

-- Counted stock moves in one statement, so two counters selling at once never lose a count.
create or replace function public.ms_qty_add(p_owner uuid, p_item uuid, p_delta integer, p_cost bigint default null)
returns integer language sql security definer set search_path = public as $$
  update public.ms_items
     set qty = qty + p_delta, cost_paise = coalesce(p_cost, cost_paise), updated_at = now()
   where id = p_item and owner_id = p_owner
  returning qty;
$$;
revoke all on function public.ms_qty_add(uuid, uuid, integer, bigint) from public, anon, authenticated;
grant execute on function public.ms_qty_add(uuid, uuid, integer, bigint) to service_role;

alter table public.ms_items enable row level security;
alter table public.ms_units enable row level security;
alter table public.ms_purchases enable row level security;
alter table public.ms_bills enable row level security;
revoke all on public.ms_items, public.ms_units, public.ms_purchases, public.ms_bills from anon, authenticated;
