-- 0062 — Live help: the person's actual screen (owner's call, 1 Oct 2026).
--
-- 0061 reported only WHICH screen someone was on. Staff helping over the phone need to see the screen
-- itself — the half-filled form, the button they cannot find — so the app now records its own page and
-- the console replays it.
--
-- What travels: the page's structure and what changes on it, including what the person types into forms
-- (owner's call — "their city went in the name box" is exactly what staff must be able to see). Password
-- fields are the one exception and are never sent.
--
-- These rows are working data, not a record to keep: they are deleted when the session ends, and anything
-- older than a day is swept up (scripts/cleanup-30d.mjs). A session is minutes long.

create table if not exists public.support_events (
  id         bigserial primary key,
  session_id uuid not null references public.support_sessions(id) on delete cascade,
  -- Batch number from the app, so a reconnecting console can ask for "everything after".
  seq        bigint not null,
  -- This batch opens with a full picture of the page, so a staff member joining late can start here
  -- instead of replaying from the beginning.
  snapshot   boolean not null default false,
  events     jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists support_events_session_idx on public.support_events (session_id, id);
create index if not exists support_events_snapshot_idx on public.support_events (session_id, id desc) where snapshot;
create index if not exists support_events_age_idx on public.support_events (created_at);

-- Written only by /api/support/events and read only by /api/admin/support/events, both with the service
-- role after checking who is asking. Nobody reads this table directly — not even the person it is about,
-- because there is nothing here they cannot already see on their own screen.
alter table public.support_events enable row level security;
revoke all on public.support_events from anon, authenticated;
grant all on public.support_events to service_role;
grant usage, select on sequence public.support_events_id_seq to service_role;
