-- 0061 — Live help (owner's call, 1 Oct 2026).
--
-- A card holder who is stuck and a staff member who can see what they are looking at. One row per help
-- session. The person's app reports which screen they are on; the staff console reads that and can send
-- them to another screen. Nothing is reported unless a session is live, and a session only goes live when
-- BOTH sides have agreed — the person asks for help, or staff asks and the person says yes.
--
-- What is stored is the screen they are on and what their card is still missing. Not what they type: this
-- is deliberately not a screen recording (see src/lib/help-screens.ts and /admin/support).

create table if not exists public.support_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- 'requested' the person asked for help and nobody has picked it up yet
  -- 'invited'   staff asked and the person has not answered yet
  -- 'live'      both sides agreed — the only state in which the screen is reported
  -- 'ended'     finished, declined, or gone quiet
  status        text not null default 'requested' check (status in ('requested', 'invited', 'live', 'ended')),
  opened_by     text not null default 'user' check (opened_by in ('user', 'staff')),
  staff_name    text,                               -- who is helping; shown to the person in the banner
  note          text,                               -- what the person said they are stuck on
  user_path     text,                               -- the screen they are on right now
  user_state    jsonb not null default '{}'::jsonb, -- screen name, step, what is still empty
  guide_path    text,                               -- staff is sending them to this screen
  guide_at      timestamptz,                        -- when — the app only follows a fresh one
  user_seen_at  timestamptz,                        -- last report from the person's app
  staff_seen_at timestamptz,                        -- last read by the console
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);

create index if not exists support_sessions_user_idx on public.support_sessions (user_id, created_at desc);
create index if not exists support_sessions_open_idx on public.support_sessions (created_at desc) where status <> 'ended';

-- Writes go only through /api/support/* and /api/admin/support, which check who is asking and write with the
-- service role. The person may read their own session (the banner, and "staff wants to help" waiting for an
-- answer); they may not write it, so nobody can put themselves into someone else's session.
alter table public.support_sessions enable row level security;
revoke all on public.support_sessions from anon, authenticated;
grant select on public.support_sessions to authenticated;
grant all on public.support_sessions to service_role;

drop policy if exists support_sessions_own_read on public.support_sessions;
create policy support_sessions_own_read on public.support_sessions
  for select to authenticated using (user_id = auth.uid());
