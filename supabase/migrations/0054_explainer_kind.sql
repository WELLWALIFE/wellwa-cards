-- The long explainer video (the owner's own text → a 2 to 10 minute video) is a new kind of media job.
-- Additive and safe to run twice: it only widens the list of allowed values.
alter table public.media_jobs drop constraint if exists media_jobs_kind_check;
alter table public.media_jobs add constraint media_jobs_kind_check check (kind in ('banner', 'reel', 'ad', 'explainer'));
notify pgrst, 'reload schema';
select 'explainer kind ready' as status;
