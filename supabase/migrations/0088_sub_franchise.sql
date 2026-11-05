-- Sub-franchises (owner, 6 Nov 2026): a franchise may make sub-franchises under it (one level only). A sub-franchise is an ordinary
-- franchise row with parent_id set: its own code / sign-up link, logins, users, ledger and payouts. On every payment of a sub's user the
-- sub earns its own percent and the parent earns the difference (its percent − the sub's) as an "override" earning. Shubhora pays both.
alter table public.franchises add column if not exists parent_id uuid references public.franchises(id) on delete set null;
create index if not exists franchises_parent_idx on public.franchises (parent_id) where parent_id is not null;
do $$ begin
  alter table public.franchises add constraint franchises_parent_not_self check (parent_id is null or parent_id <> id);
exception when duplicate_object then null; end $$;

-- Every login to the admin panel (owner, 6 Nov 2026: "login aur pura track record"): who, when, from where, and failed tries.
create table if not exists public.admin_login_events (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  admin_id      uuid,                                   -- admin_users.id (null for a failed try with an unknown login)
  login         text not null default '',               -- what was typed (mobile / e-mail), for failed tries
  franchise_id  uuid references public.franchises(id) on delete set null,
  ok            boolean not null default true,
  reason        text not null default '',               -- "wrong password", "2-step", "blocked" …
  ip            text not null default '',
  ua            text not null default ''
);
create index if not exists admin_login_events_admin_idx on public.admin_login_events (admin_id, at desc);
create index if not exists admin_login_events_fr_idx on public.admin_login_events (franchise_id, at desc);
create index if not exists admin_login_events_at_idx on public.admin_login_events (at desc);
alter table public.admin_login_events enable row level security;   -- service role only
