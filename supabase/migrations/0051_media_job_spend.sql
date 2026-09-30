-- 0051: partial refunds. media_jobs.spent_credits records how much of a job's own cost has
-- already been handed to a paid outside service (Veo / Kling / fal clips, AI images, TTS) by the
-- moment the owner taps Cancel.
--
-- Why it is needed: src/app/api/media/jobs/route.ts today refunds job.cost in FULL for a row that
-- is 'queued' or 'running', and the worker only notices a cancel at the very end of the render.
-- So "queue a video, wait until the paid clips are made, cancel, repeat" is unlimited outside
-- spend at zero credits. With this column the cancel refunds cost - spent_credits:
--   * still queued      → spent_credits = 0 → the owner gets everything back (nothing was bought);
--   * template ads      → no paid API is called at all → spent_credits stays 0 → full refund;
--   * clips already paid → we return only the part we have not spent, and never charge for work
--     we did not deliver.
-- The media worker (service_role) is the only writer: it sets this immediately BEFORE its first
-- paid call, so the number is always honest-or-pessimistic, never optimistic.
--
-- Additive and safe to run twice: the column is added only if missing, every existing row simply
-- gets 0, nothing is dropped or rewritten, and no RLS policy changes. Owners can already read it
-- through the table-wide "grant select on public.media_jobs to authenticated" from 0020, guarded
-- by the existing "own jobs" policy; service_role bypasses RLS and does the writing.
-- Run once in Supabase → SQL editor.

alter table public.media_jobs
  add column if not exists spent_credits integer not null default 0;

comment on column public.media_jobs.spent_credits is
  'Credits of this job already consumed by paid outside APIs (Veo/Kling/fal clips, AI images, TTS). A cancel refunds cost - spent_credits, so we never hand back money that is already spent. Written by the media worker (service_role) only.';

-- Money cannot be "un-spent": a negative value here would make a cancel refund MORE than the job
-- ever cost. The column is brand new, so every existing row is 0 and this constraint cannot fail
-- on current data. Dropped first so the whole file stays re-runnable.
alter table public.media_jobs drop constraint if exists media_jobs_spent_credits_check;
alter table public.media_jobs add constraint media_jobs_spent_credits_check check (spent_credits >= 0);

-- The worker PATCHes this column through PostgREST and the cancel route selects it; without a
-- reload PostgREST keeps answering "column media_jobs.spent_credits does not exist" from its
-- cached schema, which would make every cancel fail.
notify pgrst, 'reload schema';

select 'media job spend ready' as status;
