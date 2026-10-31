-- 0078: Admin v2 (owner, 31 Oct 2026: "professional admin panel, jugaad nahi" — one panel, one login with 2-step,
-- roles and rights, franchises with their own panel and earnings, and an audit log of everything an admin does).
--   franchises        channel partners: code, area, commission %; a user belongs to one (profiles.franchise_id)
--   admin_users       who may open /admin: the account (the same login as the app), its role, rights and franchise scope
--   franchise_ledger  every rupee a franchise earned (per payment), was paid, or was adjusted; payouts = the requests
--   audit_log         who did what, when, to whom, with before / after
--   admin_settings    platform settings (enforce 2-step, commission defaults …)
--   user_notes        support notes on a user
-- Read and written only by the app's API with the service role (it checks the admin's rights): RLS on, nothing
-- granted to anon / authenticated. Safe to run more than once.

create table if not exists public.franchises (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique check (code ~ '^[A-Z0-9]{3,16}$'),
  name                    text not null,                          -- the person
  company                 text not null default '',
  phone                   text not null default '',
  email                   text not null default '',
  gstin                   text not null default '',
  pan                     text not null default '',
  area                    text not null default '',               -- the territory in words ("Jaipur city", "Sikar district")
  city                    text not null default '',
  state                   text not null default '',
  pincode                 text not null default '',
  commission_first_pct    numeric(5,2) not null default 20 check (commission_first_pct between 0 and 100),
  commission_renewal_pct  numeric(5,2) not null default 10 check (commission_renewal_pct between 0 and 100),
  can_activate            boolean not null default false,         -- may activate a plan for their user (payment taken by hand)
  status                  text not null default 'active' check (status in ('active','paused','ended')),
  bank                    jsonb not null default '{}'::jsonb,     -- { holder, bank, account, ifsc, upi }
  kyc                     jsonb not null default '{}'::jsonb,     -- { aadhaar_last4, pan_verified, docs: [...] }
  agreement_at            date,
  target_paise            bigint not null default 0,              -- monthly target (sales value)
  notes                   text not null default '',
  owner_user_id           uuid references public.profiles(id) on delete set null,   -- the franchise's own login
  created_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.profiles add column if not exists franchise_id uuid references public.franchises(id) on delete set null;
alter table public.profiles add column if not exists franchise_joined_at timestamptz;
create index if not exists profiles_franchise_idx on public.profiles (franchise_id) where franchise_id is not null;

create table if not exists public.admin_users (
  id                    uuid primary key references public.profiles(id) on delete cascade,
  email                 text not null default '',
  name                  text not null default '',
  phone                 text not null default '',
  role                  text not null default 'custom' check (role in ('super_admin','admin','support','sales','content','franchise','custom')),
  rights                text[] not null default '{}',
  franchise_id          uuid references public.franchises(id) on delete set null,
  active                boolean not null default true,
  must_change_password  boolean not null default false,
  last_login_at         timestamptz,
  last_ip               text not null default '',
  created_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists admin_users_franchise_idx on public.admin_users (franchise_id) where franchise_id is not null;

create table if not exists public.franchise_ledger (
  id            bigserial primary key,
  franchise_id  uuid not null references public.franchises(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  kind          text not null check (kind in ('earning','payout','adjustment','reversal')),
  amount_paise  bigint not null,                                  -- + earned / adjusted up, − paid out / adjusted down
  base_paise    bigint,                                           -- the payment it was computed from
  pct           numeric(5,2),
  payment_ref   text not null default '',                         -- Razorpay payment id (an earning is written once per payment)
  note          text not null default '',
  payout_id     uuid,
  created_by    uuid,
  at            timestamptz not null default now()
);
create index if not exists franchise_ledger_fr_idx on public.franchise_ledger (franchise_id, at desc);
create unique index if not exists franchise_ledger_once_idx on public.franchise_ledger (franchise_id, payment_ref, kind) where payment_ref <> '';

create table if not exists public.payouts (
  id            uuid primary key default gen_random_uuid(),
  franchise_id  uuid not null references public.franchises(id) on delete cascade,
  amount_paise  bigint not null check (amount_paise > 0),
  status        text not null default 'requested' check (status in ('requested','approved','paid','rejected')),
  utr           text not null default '',
  note          text not null default '',
  requested_by  uuid,
  requested_at  timestamptz not null default now(),
  decided_by    uuid,
  decided_at    timestamptz,
  paid_at       timestamptz
);
create index if not exists payouts_fr_idx on public.payouts (franchise_id, requested_at desc);
create index if not exists payouts_status_idx on public.payouts (status) where status in ('requested','approved');

create table if not exists public.audit_log (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  actor_id      uuid,
  actor_email   text not null default '',
  actor_role    text not null default '',
  action        text not null,                                    -- "user.plan", "franchise.create", "staff.rights" …
  target_type   text not null default '',                         -- user | franchise | staff | setting | payout …
  target_id     text not null default '',
  target_label  text not null default '',
  before        jsonb,
  after         jsonb,
  note          text not null default '',
  ip            text not null default '',
  ua            text not null default ''
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_type, target_id, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, at desc);

create table if not exists public.admin_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

create table if not exists public.user_notes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  by_id     uuid,
  by_name   text not null default '',
  text      text not null,
  pinned    boolean not null default false,
  at        timestamptz not null default now()
);
create index if not exists user_notes_user_idx on public.user_notes (user_id, pinned desc, at desc);

alter table public.franchises       enable row level security;
alter table public.admin_users      enable row level security;
alter table public.franchise_ledger enable row level security;
alter table public.payouts          enable row level security;
alter table public.audit_log        enable row level security;
alter table public.admin_settings   enable row level security;
alter table public.user_notes       enable row level security;
revoke all on public.franchises, public.admin_users, public.franchise_ledger, public.payouts, public.audit_log, public.admin_settings, public.user_notes from anon, authenticated;
grant all on public.franchises, public.admin_users, public.franchise_ledger, public.payouts, public.audit_log, public.admin_settings, public.user_notes to service_role;
grant usage, select, update on sequence public.franchise_ledger_id_seq, public.audit_log_id_seq to service_role;
