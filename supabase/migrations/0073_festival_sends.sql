-- 0073 — festival wishes that resume, and one lead per card-chat visitor (code review, Oct 2026). Safe to run more than once.
--
-- 1) festival_sends: every number a festival wish went to (src/app/api/cron/festival-wishes). A number is claimed here
--    BEFORE its send (unique per owner + festival + phone), so the cron can stop after a few minutes, be called again
--    and carry on, and a rerun or an overlapping run never wishes anyone twice. festival = '<key>:<IST date>'.
--    Service role only (RLS on, no policies).
create table if not exists public.festival_sends (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  festival text not null,
  phone    text not null,          -- digits with country code, as sent to the bridge
  sent_at  timestamptz not null default now()
);
create unique index if not exists festival_sends_uniq on public.festival_sends(owner_id, festival, phone);
alter table public.festival_sends enable row level security;

-- 2) leads.chat_session: the card chat's conversation id (src/components/card-chat.tsx, one per chat session). The
--    visitor's "Card chat visitor" lead and the order that fills it in are keyed to it (src/app/api/chat/[username]),
--    so two visitors of one card are never joined into one lead. Null for every other lead (nulls never clash).
alter table public.leads add column if not exists chat_session text;
create unique index if not exists leads_chat_session_uniq on public.leads(card_id, chat_session);

notify pgrst, 'reload schema';
