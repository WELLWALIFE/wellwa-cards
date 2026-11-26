-- 0101: Shubhora Mobile Shop, phase 4 (owner, 26 Nov 2026 — the 8 features the market apps have and we did not): udhaar reminders,
-- photos and the customer's signature on a repair job, shop expenses (cash book), branches with stock per branch and stock
-- transfer, and purchase orders. Points, combo offers and staff commission live in owner_prefs.crm.mobileSetup (no table).
-- Service role only (RLS on, nothing granted). Safe to run more than once.

-- Udhaar reminders: when the customer was last reminded about this bill.
alter table public.ms_bills add column if not exists reminded_at timestamptz;
-- Branches: '' is the main shop; any other value is a branch id from mobileSetup.stores.
alter table public.ms_bills add column if not exists store text not null default '';
alter table public.ms_units add column if not exists store text not null default '';
alter table public.ms_purchases add column if not exists store text not null default '';
alter table public.ms_jobs add column if not exists store text not null default '';
create index if not exists ms_bills_due_idx on public.ms_bills (owner_id, status, balance_paise) where kind = 'sale' and status = 'open';

-- Repair: photos of the phone when it came in, and the customer's signature (links to the app's own storage).
alter table public.ms_jobs add column if not exists photos text[] not null default '{}';
alter table public.ms_jobs add column if not exists signature text not null default '';

-- Purchase orders: a purchase is 'received' (stock came in) or 'ordered' (a PO sent to the supplier, no stock yet).
alter table public.ms_purchases add column if not exists status text not null default 'received';
alter table public.ms_purchases drop constraint if exists ms_purchases_status_check;
alter table public.ms_purchases add constraint ms_purchases_status_check check (status in ('received','ordered','cancelled'));

-- Expenses: rent, electricity, salary, tea… — what goes out of the shop that is not stock.
create table if not exists public.ms_expenses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  day             date not null,
  category        text not null default 'other',
  amount_paise    bigint not null default 0 check (amount_paise >= 0),
  mode            text not null default 'cash',
  note            text not null default '',
  store           text not null default '',
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists ms_expenses_owner_idx on public.ms_expenses (owner_id, day desc);

-- Counted stock in a branch. ms_items.qty stays the WHOLE stock (every place together); the main shop's own count is
-- ms_items.qty minus the branches. So everything that worked before keeps working with no branches at all.
create table if not exists public.ms_store_qty (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  item_id    uuid not null references public.ms_items(id) on delete cascade,
  store      text not null,
  qty        integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, item_id, store)
);
create or replace function public.ms_store_qty_add(p_owner uuid, p_item uuid, p_store text, p_delta integer)
returns integer language sql security definer set search_path = public as $$
  insert into public.ms_store_qty (owner_id, item_id, store, qty) values (p_owner, p_item, p_store, p_delta)
  on conflict (owner_id, item_id, store) do update set qty = public.ms_store_qty.qty + excluded.qty, updated_at = now()
  returning qty;
$$;
revoke all on function public.ms_store_qty_add(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.ms_store_qty_add(uuid, uuid, text, integer) to service_role;

-- Stock moved from one place to another (main shop '' or a branch).
create table if not exists public.ms_transfers (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  from_store      text not null default '',
  to_store        text not null default '',
  lines           jsonb not null default '[]'::jsonb,     -- [{itemId,name,qty,imeis}]
  note            text not null default '',
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists ms_transfers_owner_idx on public.ms_transfers (owner_id, created_at desc);

alter table public.ms_expenses enable row level security;
alter table public.ms_store_qty enable row level security;
alter table public.ms_transfers enable row level security;
revoke all on public.ms_expenses, public.ms_store_qty, public.ms_transfers from anon, authenticated;
