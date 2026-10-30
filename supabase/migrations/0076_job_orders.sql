-- 0076: Orders & job cards (owner, 30 Oct 2026: a saree showroom — sarees go to karigars for fall-pico, blouse stitching,
-- alterations; the tailor notes the customer's measurements in the app, another tailor cuts and stitches from them, every
-- cloth given and taken back is recorded, the customer gets a WhatsApp update when it is ready, and the owner sees the
-- status of any garment at any time). Generic enough for any boutique, tailor, dry-cleaner or repair shop.
--
-- Read and written only through the app's API with the service role (the API checks owner / team role), so RLS is on and
-- no policy is granted to anon or authenticated. Safe to run more than once.

create table if not exists public.job_karigars (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  phone       text not null default '',
  skill       text not null default '',              -- e.g. "fall-pico", "blouse", "embroidery"
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists job_karigars_owner_idx on public.job_karigars (owner_id, active);

create table if not exists public.job_orders (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  number         integer not null,                    -- the shop's own running job number (#101, #102 …)
  order_ref      text not null default '',            -- jobs booked together share it (one customer visit)
  customer_name  text not null default '',
  customer_phone text not null default '',            -- +91XXXXXXXXXX
  item           text not null default '',            -- e.g. "Saree", "Blouse", "Lehenga"
  work           text not null default '',            -- e.g. "Fall-pico", "Stitching", "Alteration"
  details        text not null default '',
  measurement_id uuid,                                -- the measurement this job is cut from
  qty            integer not null default 1,
  status         text not null default 'received'
                 check (status in ('received','cutting','stitching','finishing','ready','delivered','cancelled')),
  karigar_id     uuid references public.job_karigars(id) on delete set null,
  assigned_to    uuid references public.profiles(id) on delete set null,   -- a team member with the app (tailor)
  due_date       date,
  amount_paise   bigint not null default 0,
  advance_paise  bigint not null default 0,
  photos         jsonb not null default '[]'::jsonb,
  created_by     uuid references public.profiles(id) on delete set null,
  notified_at    timestamptz,                         -- "ready" WhatsApp sent to the customer
  delivered_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (owner_id, number)
);
create index if not exists job_orders_owner_idx on public.job_orders (owner_id, status, due_date);
create index if not exists job_orders_phone_idx on public.job_orders (owner_id, customer_phone);
create index if not exists job_orders_assigned_idx on public.job_orders (assigned_to) where assigned_to is not null;

-- Everything that happens to a job: status changes, who has it, cloth given / taken back, payments, notes.
create table if not exists public.job_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  job_id      uuid not null references public.job_orders(id) on delete cascade,
  kind        text not null check (kind in ('created','status','assign','cloth_out','cloth_in','payment','note','notify')),
  status      text not null default '',
  karigar_id  uuid references public.job_karigars(id) on delete set null,
  karigar     text not null default '',
  pieces      integer,
  meters      numeric(8,2),
  amount_paise bigint,
  note        text not null default '',
  by_user     uuid references public.profiles(id) on delete set null,
  by_name     text not null default '',
  at          timestamptz not null default now()
);
create index if not exists job_events_job_idx on public.job_events (job_id, at);
create index if not exists job_events_karigar_idx on public.job_events (owner_id, karigar_id, at);

-- A customer's measurements (kept as history: every new measurement is a new row).
create table if not exists public.job_measurements (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  customer_phone text not null default '',
  customer_name  text not null default '',
  garment        text not null default 'Blouse',
  unit           text not null default 'inch' check (unit in ('inch','cm')),
  sizes          jsonb not null default '{}'::jsonb,   -- { "Bust": "34", "Waist": "30", … }
  notes          text not null default '',
  taken_by       uuid references public.profiles(id) on delete set null,
  taken_by_name  text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists job_measurements_phone_idx on public.job_measurements (owner_id, customer_phone, created_at desc);

alter table public.job_karigars     enable row level security;
alter table public.job_orders       enable row level security;
alter table public.job_events       enable row level security;
alter table public.job_measurements enable row level security;
revoke all on public.job_karigars, public.job_orders, public.job_events, public.job_measurements from anon, authenticated;
