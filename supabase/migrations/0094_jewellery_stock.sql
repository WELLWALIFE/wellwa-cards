-- 0094: Shubhora Jewellery, phase 3 (owner, 23 Nov 2026 — plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK): stock by the piece.
-- Every piece in the showcase gets a tag number (printed as a barcode label), its weights, purity and HUID. Billing a tag fills the
-- bill line and marks the piece sold; cancelling that bill puts it back in stock. Same units and rules as 0092 / 0093: paise,
-- milligrams, basis points; service role only (RLS on, nothing granted to anon / authenticated). Safe to run more than once.

create table if not exists public.jw_stock (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  seq             integer not null,                         -- the shop's running number, the digits of the tag
  tag             text not null,                            -- "RI00017": item code + running number (the barcode)
  status          text not null default 'in_stock' check (status in ('in_stock','approval','sold','melted','returned')),
  item_type       text not null default '',
  descr           text not null default '',
  purity          text not null default '',
  pieces          integer not null default 1,
  gross_mg        bigint not null default 0,
  stone_mg        bigint not null default 0,
  net_mg          bigint not null default 0,
  stone_paise     bigint not null default 0,
  making          text not null default '' check (making in ('','per_g','pct','piece')),  -- '' = the item type's making
  making_value    bigint not null default 0,
  wastage_bp      integer not null default 0,
  huid            text not null default '',                 -- BIS hallmark id, 6 letters / digits
  size            text not null default '',
  counter         text not null default '',                 -- where it is kept: "Counter 1", "Locker"
  source          text not null default '',                 -- "Karigar Ramesh", "Purchase — XYZ", "Order ORD/…"
  cost_paise      bigint not null default 0,                -- what the shop paid (owner only)
  bill_id         uuid references public.jw_bills(id) on delete set null,
  sold_at         timestamptz,
  status_note     text not null default '',                 -- why it left the showcase (approval to whom, melted, returned)
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, tag),
  unique (owner_id, seq)
);
create index if not exists jw_stock_status_idx on public.jw_stock (owner_id, status, item_type);
create index if not exists jw_stock_huid_idx on public.jw_stock (owner_id, huid) where huid <> '';
create index if not exists jw_stock_bill_idx on public.jw_stock (bill_id) where bill_id is not null;

alter table public.jw_stock enable row level security;
revoke all on public.jw_stock from anon, authenticated;
