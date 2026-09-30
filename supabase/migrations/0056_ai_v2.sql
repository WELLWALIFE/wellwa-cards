-- New AI for Shubhora partners (owner's call, 26 Sep 2026): the switch Super Admin → Shubhora AI → "New AI" writes.
--   'off'       every assistant exactly as before (the default)
--   'niteen'    a pilot: only these card names (comma separated)
--   'shubhora'  every Shubhora partner card (WhatsApp + card chat)
--   'all'       Shubhora partners + every other card gets memory across days and the personal-message filter
-- The WhatsApp bridge reads it every 5 minutes, the card chat on every message. Safe to run twice.
alter table public.platform_settings add column if not exists ai_v2 text not null default 'off';

select ai_v2 from public.platform_settings where id = 1;
