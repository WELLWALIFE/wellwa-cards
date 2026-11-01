-- 0083 — Month plan v2 (owner, 1 Nov 2026: "ek professional month plan, har post apni baat kahe"). Safe to run more than once.
-- Each planned day now carries the AI's brief — the idea, the caption, the hashtags, why this post — next to the poster's own
-- heading / line (overrides). New day kinds: tip (काम की बात), trust (हम क्यों), about (हमारी कहानी).
alter table public.poster_calendar add column if not exists brief jsonb not null default '{}'::jsonb;
alter table public.poster_calendar drop constraint if exists poster_calendar_kind_check;
alter table public.poster_calendar add constraint poster_calendar_kind_check
  check (kind in ('auto','festival','product','offer','greeting','testimonial','tip','trust','about','skip'));
-- The brand (tone, audience, palette) lives in poster_profiles.layout (jsonb) — no new columns.
notify pgrst, 'reload schema';
select 'ok' as status;
