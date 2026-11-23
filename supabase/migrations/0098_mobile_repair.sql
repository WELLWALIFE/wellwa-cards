-- 0098: Shubhora Mobile Shop, phase 2 (owner, 23 Nov 2026 — plan https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd): repair job
-- cards. A phone comes in (problem, condition, estimate, advance), parts from stock and a repair charge go on it, and giving it
-- back makes a bill in ms_bills. Money in paise. Service role only (RLS on, nothing granted). Safe to run more than once.

create table if not exists public.ms_jobs (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  number          integer not null,
  fin_year        text not null,
  code            text not null,                          -- "MJ/2026-27/14"
  status          text not null default 'received' check (status in ('received','repairing','waiting','ready','delivered','returned','cancelled')),
  customer_name   text not null default '',
  customer_phone  text not null default '',
  device          text not null default '',               -- "Redmi Note 13 Pro, blue"
  imei            text not null default '',
  problems        text[] not null default '{}',
  problem_note    text not null default '',
  condition       text[] not null default '{}',           -- noted when it came in: scratches, SIM inside…
  accessories     text not null default '',               -- what came with it: cover, charger…
  lock_code       text not null default '',               -- PIN / pattern, if the customer gave it; never on the customer's link
  est_paise       bigint not null default 0,
  labour_paise    bigint not null default 0,
  parts           jsonb not null default '[]'::jsonb,     -- [{itemId,name,qty,price,cost}] — already out of stock
  payments        jsonb not null default '[]'::jsonb,     -- advances
  due_date        date,
  tech_id         uuid,                                   -- crm_agents.id of the technician
  tech_name       text not null default '',
  notes           text not null default '',
  events          jsonb not null default '[]'::jsonb,     -- the timeline: [{at,by,text}]
  bill_id         uuid references public.ms_bills(id) on delete set null,
  warranty_days   integer not null default 0,
  token           text not null default replace(gen_random_uuid()::text, '-', ''),  -- the customer's link /mr/<id>?t=<token>
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  cancel_reason   text not null default '',
  delivered_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, fin_year, number)
);
create index if not exists ms_jobs_owner_idx on public.ms_jobs (owner_id, status, created_at desc);
create index if not exists ms_jobs_phone_idx on public.ms_jobs (owner_id, customer_phone);
create index if not exists ms_jobs_bill_idx on public.ms_jobs (bill_id) where bill_id is not null;

alter table public.ms_jobs enable row level security;
revoke all on public.ms_jobs from anon, authenticated;
